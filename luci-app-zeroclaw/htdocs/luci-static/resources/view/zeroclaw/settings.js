'use strict';
'require form';
'require fs';
'require poll';
'require rpc';
'require uci';
'require ui';
'require view';

var callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: [ 'name' ],
	expect: { '': {} }
});

function serviceRunning(result) {
	var instances, k;

	try {
		instances = (result.zeroclaw && result.zeroclaw.instances) || {};
		for (k in instances)
			if (instances[k] && instances[k].running)
				return true;

		return false;
	}
	catch (e) {
		return false;
	}
}

function execText(cmd, args) {
	return L.resolveDefault(fs.exec_direct(cmd, args || [], 'text'), '');
}

return view.extend({
	load: function() {
		return uci.load('zeroclaw');
	},

	render: function() {
		var m, s;

		m = new form.Map('zeroclaw', _('ZeroClaw'), _('Configure the ZeroClaw runtime and manage its service state.'));

		s = m.section(form.NamedSection, 'main', 'zeroclaw', _('Basic Settings'));
		s.anonymous = true;

		var o = s.option(form.Flag, 'enabled', _('Enable'));
		o.rmempty = false;

		o = s.option(form.Value, 'host', _('Listen host'));
		o.datatype = 'ipaddr("nomask")';
		o.placeholder = '127.0.0.1';
		o.rmempty = false;

		o = s.option(form.Value, 'port', _('Listen port'));
		o.datatype = 'port';
		o.placeholder = '42617';
		o.rmempty = false;

		o = s.option(form.Flag, 'allow_public_bind', _('Allow public bind'));
		o.rmempty = false;

		o = s.option(form.Value, 'workspace', _('Workspace'));
		o.placeholder = '/var/lib/zeroclaw';
		o.rmempty = false;

		o = s.option(form.ListValue, 'log_level', _('Log level'));
		[ 'trace', 'debug', 'info', 'warn', 'error' ].forEach(function(level) {
			o.value(level);
		});
		o.default = 'info';

		s = m.section(form.NamedSection, 'main', 'zeroclaw', _('Provider Settings'));
		s.anonymous = true;

		o = s.option(form.Value, 'provider', _('Provider'));
		o.placeholder = 'openrouter';
		o.rmempty = false;

		o = s.option(form.Value, 'api_base', _('API base URL'));
		o.placeholder = 'https://api.example.com/v1';

		o = s.option(form.Value, 'model', _('Model'));
		o.placeholder = 'anthropic/claude-sonnet-4-6';

		o = s.option(form.Value, 'api_key', _('API key'));
		o.password = true;
		o.rmempty = true;

		return m.render().then(function(node) {
			var statusBody = E('pre', {
				'id': 'zeroclaw-status-output',
				'style': 'white-space: pre-wrap; margin: 0;'
			}, [ _('Loading status...') ]);

			var doctorBody = E('pre', {
				'id': 'zeroclaw-doctor-output',
				'style': 'white-space: pre-wrap; margin: 0;'
			}, [ _('Click Run doctor to collect diagnostics.') ]);

			var logBody = E('pre', {
				'id': 'zeroclaw-log-output',
				'style': 'white-space: pre-wrap; margin: 0; max-height: 18rem; overflow: auto;'
			}, [ _('Loading logs...') ]);

			function refreshStatus() {
				return Promise.all([
					callServiceList('zeroclaw'),
					execText('/etc/init.d/zeroclaw', [ 'status' ]),
					execText('/usr/bin/zeroclaw', [ 'status' ])
				]).then(function(res) {
					var running = serviceRunning(res[0]) ? _('running') : _('stopped');
					var initStatus = (res[1] || '').trim();
					var runtimeStatus = (res[2] || '').trim();
					statusBody.textContent = [
						_('Service state: ') + running,
						'',
						_('Init status:'),
						initStatus || _('No init status output.'),
						'',
						_('Runtime status:'),
						runtimeStatus || _('No runtime status output.')
					].join('\n');
				}).catch(function(err) {
					statusBody.textContent = _('Unable to read status: ') + err;
				});
			}

			function refreshLogs() {
				return execText('/sbin/logread', []).then(function(output) {
					var text = (output || '').trim();
					var lines = text ? text.split('\n').filter(function(line) {
						return line.toLowerCase().indexOf('zeroclaw') >= 0;
					}) : [];

					if (lines.length > 60)
						lines = lines.slice(lines.length - 60);

					logBody.textContent = lines.length ? lines.join('\n') : _('No ZeroClaw log lines found in logread.');
				}).catch(function(err) {
					logBody.textContent = _('Unable to read logs: ') + err;
				});
			}

			function runInit(action) {
				return execText('/etc/init.d/zeroclaw', [ action ]).then(function(output) {
					ui.addNotification(null, E('p', {}, [ output || (_('Action completed: ') + action) ]));
					return Promise.all([ refreshStatus(), refreshLogs() ]);
				}).catch(function(err) {
					ui.addNotification(null, E('p', {}, [ _('Action failed: ') + err ]), 'danger');
				});
			}

			function runDoctor() {
				doctorBody.textContent = _('Running doctor...');
				return execText('/usr/bin/zeroclaw', [ 'doctor' ]).then(function(output) {
					doctorBody.textContent = (output || '').trim() || _('No doctor output.');
				}).catch(function(err) {
					doctorBody.textContent = _('Doctor failed: ') + err;
				});
			}

			function toggleBoot(action) {
				return execText('/etc/init.d/zeroclaw', [ action ]).then(function(output) {
					ui.addNotification(null, E('p', {}, [ output || (_('Boot action completed: ') + action) ]));
					return Promise.all([ refreshStatus(), refreshLogs() ]);
				}).catch(function(err) {
					ui.addNotification(null, E('p', {}, [ _('Boot action failed: ') + err ]), 'danger');
				});
			}

			node.appendChild(E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, [ _('Service Control') ]),
				E('div', { 'class': 'cbi-value' }, [
					E('button', {
						'class': 'btn cbi-button cbi-button-action',
						'click': ui.createHandlerFn(this, function() { return runInit('start'); })
					}, [ _('Start') ]),
					E('button', {
						'class': 'btn cbi-button cbi-button-neutral',
						'style': 'margin-left: 8px',
						'click': ui.createHandlerFn(this, function() { return runInit('stop'); })
					}, [ _('Stop') ]),
					E('button', {
						'class': 'btn cbi-button cbi-button-apply',
						'style': 'margin-left: 8px',
						'click': ui.createHandlerFn(this, function() { return runInit('restart'); })
					}, [ _('Restart') ]),
					E('button', {
						'class': 'btn cbi-button',
						'style': 'margin-left: 8px',
						'click': ui.createHandlerFn(this, function() { return runDoctor(); })
					}, [ _('Run doctor') ]),
					E('button', {
						'class': 'btn cbi-button',
						'style': 'margin-left: 8px',
						'click': ui.createHandlerFn(this, function() { return toggleBoot('enable'); })
					}, [ _('Enable boot') ]),
					E('button', {
						'class': 'btn cbi-button',
						'style': 'margin-left: 8px',
						'click': ui.createHandlerFn(this, function() { return toggleBoot('disable'); })
					}, [ _('Disable boot') ])
				]),
				E('div', { 'class': 'cbi-value' }, [ statusBody ]),
				E('h3', { 'style': 'margin-top: 1em' }, [ _('Doctor Output') ]),
				E('div', { 'class': 'cbi-value' }, [ doctorBody ]),
				E('h3', { 'style': 'margin-top: 1em' }, [ _('Recent Logs') ]),
				E('div', { 'class': 'cbi-value' }, [ logBody ])
			]));

			poll.add(function() {
				return Promise.all([ refreshStatus(), refreshLogs() ]);
			});

			refreshStatus();
			refreshLogs();
			return node;
		});
	}
});

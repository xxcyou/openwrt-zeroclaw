'use strict';
'require fs';
'require poll';
'require rpc';
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

function statusBadge(running) {
	return E('span', {
		'class': 'zc-badge ' + (running ? 'zc-badge-running' : 'zc-badge-stopped')
	}, [ running ? _('running') : _('stopped') ]);
}

return view.extend({
	render: function() {
		var statusValue = E('div', { 'class': 'zc-hero-status' }, [ _('Loading status...') ]);
		var runtimeValue = E('div', { 'class': 'zc-metric-main' }, [ '-' ]);
		var initValue = E('div', { 'class': 'zc-metric-main' }, [ '-' ]);
		var doctorValue = E('pre', { 'class': 'zc-console' }, [ _('Click Run doctor to collect diagnostics.') ]);
		var logValue = E('pre', { 'class': 'zc-console' }, [ _('Loading logs...') ]);

		function refreshOverview() {
			return Promise.all([
				callServiceList('zeroclaw'),
				execText('/etc/init.d/zeroclaw', [ 'status' ]),
				execText('/usr/bin/zeroclaw', [ 'status' ])
			]).then(function(res) {
				var running = serviceRunning(res[0]);
				var initStatus = (res[1] || '').trim();
				var runtimeStatus = (res[2] || '').trim();

				statusValue.innerHTML = '';
				statusValue.appendChild(statusBadge(running));
				statusValue.appendChild(E('span', { 'class': 'zc-hero-status-text' }, [
					_('Service state: ') + (running ? _('running') : _('stopped'))
				]));

				runtimeValue.textContent = runtimeStatus || _('No runtime status output.');
				initValue.textContent = initStatus || _('No init status output.');
			}).catch(function(err) {
				statusValue.textContent = _('Unable to read status: ') + err;
				runtimeValue.textContent = _('Unable to read status: ') + err;
				initValue.textContent = _('Unable to read status: ') + err;
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

				logValue.textContent = lines.length ? lines.join('\n') : _('No ZeroClaw log lines found in logread.');
			}).catch(function(err) {
				logValue.textContent = _('Unable to read logs: ') + err;
			});
		}

		function runInit(action) {
			return execText('/etc/init.d/zeroclaw', [ action ]).then(function(output) {
				ui.addNotification(null, E('p', {}, [ output || (_('Action completed: ') + action) ]));
				return Promise.all([ refreshOverview(), refreshLogs() ]);
			}).catch(function(err) {
				ui.addNotification(null, E('p', {}, [ _('Action failed: ') + err ]), 'danger');
			});
		}

		function runDoctor() {
			doctorValue.textContent = _('Running doctor...');
			return execText('/usr/bin/zeroclaw', [ 'doctor' ]).then(function(output) {
				doctorValue.textContent = (output || '').trim() || _('No doctor output.');
			}).catch(function(err) {
				doctorValue.textContent = _('Doctor failed: ') + err;
			});
		}

		function toggleBoot(action) {
			return execText('/etc/init.d/zeroclaw', [ action ]).then(function(output) {
				ui.addNotification(null, E('p', {}, [ output || (_('Boot action completed: ') + action) ]));
				return Promise.all([ refreshOverview(), refreshLogs() ]);
			}).catch(function(err) {
				ui.addNotification(null, E('p', {}, [ _('Boot action failed: ') + err ]), 'danger');
			});
		}

		poll.add(function() {
			return Promise.all([ refreshOverview(), refreshLogs() ]);
		});

		refreshOverview();
		refreshLogs();

		return E('div', { 'class': 'zc-dashboard' }, [
			E('style', {}, [
				'.zc-dashboard{display:block;}' +
				'.zc-hero,.zc-section{border:1px solid #e5e7eb;border-radius:8px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.04);margin-bottom:16px;overflow:hidden;}' +
				'.zc-hero-head{padding:16px 18px;background:linear-gradient(135deg,#4a90d9,#357abd);color:#fff;}' +
				'.zc-hero-title{font-size:18px;font-weight:600;margin:0 0 4px 0;}' +
				'.zc-hero-desc{font-size:13px;opacity:.95;line-height:1.6;}' +
				'.zc-hero-body{padding:16px 18px;}' +
				'.zc-hero-status{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}' +
				'.zc-hero-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;}' +
				'.zc-badge{display:inline-block;padding:3px 12px;border-radius:999px;font-size:12px;font-weight:600;}' +
				'.zc-badge-running{background:#e8f7ea;color:#1a7f37;}' +
				'.zc-badge-stopped{background:#ffeef0;color:#cf222e;}' +
				'.zc-hero-status-text{font-size:13px;color:#334155;}' +
				'.zc-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;}' +
				'.zc-metric-card{padding:16px 18px;}' +
				'.zc-metric-label{font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;}' +
				'.zc-metric-main{font-size:13px;color:#111827;line-height:1.6;white-space:pre-wrap;word-break:break-word;}' +
				'.zc-section-head{padding:12px 18px;border-bottom:1px solid #eef2f7;font-weight:600;color:#334155;background:#f8fafc;}' +
				'.zc-section-body{padding:16px 18px;}' +
				'.zc-console{margin:0;white-space:pre-wrap;max-height:18rem;overflow:auto;background:#111827;color:#dbe4f0;border-radius:6px;padding:14px 16px;line-height:1.6;}'
			]),
			E('div', { 'class': 'zc-hero' }, [
				E('div', { 'class': 'zc-hero-head' }, [
					E('div', { 'class': 'zc-hero-title' }, [ _('ZeroClaw Overview') ]),
					E('div', { 'class': 'zc-hero-desc' }, [ _('This page is the daily operations dashboard for ZeroClaw. You can quickly confirm service health, run the most common actions, and inspect the latest runtime output.') ])
				]),
				E('div', { 'class': 'zc-hero-body' }, [
					statusValue,
					E('div', { 'class': 'zc-hero-actions' }, [
						E('button', {
							'class': 'btn cbi-button cbi-button-action',
							'click': ui.createHandlerFn(this, function() { return runInit('start'); })
						}, [ _('Start') ]),
						E('button', {
							'class': 'btn cbi-button cbi-button-neutral',
							'click': ui.createHandlerFn(this, function() { return runInit('stop'); })
						}, [ _('Stop') ]),
						E('button', {
							'class': 'btn cbi-button cbi-button-apply',
							'click': ui.createHandlerFn(this, function() { return runInit('restart'); })
						}, [ _('Restart') ]),
						E('button', {
							'class': 'btn cbi-button',
							'click': ui.createHandlerFn(this, function() { return runDoctor(); })
						}, [ _('Run doctor') ]),
						E('button', {
							'class': 'btn cbi-button',
							'click': ui.createHandlerFn(this, function() { return toggleBoot('enable'); })
						}, [ _('Enable boot') ]),
						E('button', {
							'class': 'btn cbi-button',
							'click': ui.createHandlerFn(this, function() { return toggleBoot('disable'); })
						}, [ _('Disable boot') ])
					])
				])
			]),
			E('div', { 'class': 'zc-metrics' }, [
				E('div', { 'class': 'zc-section zc-metric-card' }, [
					E('div', { 'class': 'zc-metric-label' }, [ _('Runtime status') ]),
					runtimeValue
				]),
				E('div', { 'class': 'zc-section zc-metric-card' }, [
					E('div', { 'class': 'zc-metric-label' }, [ _('Init status') ]),
					initValue
				])
			]),
			E('div', { 'class': 'zc-section' }, [
				E('div', { 'class': 'zc-section-head' }, [ _('Doctor Output') ]),
				E('div', { 'class': 'zc-section-body' }, [ doctorValue ])
			]),
			E('div', { 'class': 'zc-section' }, [
				E('div', { 'class': 'zc-section-head' }, [ _('Recent Logs') ]),
				E('div', { 'class': 'zc-section-body' }, [ logValue ])
			])
		]);
	}
});

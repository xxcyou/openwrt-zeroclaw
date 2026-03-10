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

function execText(cmd, args) {
	return L.resolveDefault(fs.exec_direct(cmd, args || [], 'text'), '');
}

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

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('zeroclaw'),
			L.resolveDefault(callServiceList('zeroclaw'), {})
		]);
	},

		render: function() {
			var statusBadge = E('span', { 'class': 'zc-ob-badge' }, [ _('Loading status...') ]);
			var readinessBadge = E('span', { 'class': 'zc-ob-badge zc-ob-pending' }, [ _('Checking onboarding readiness...') ]);
			var readinessSummary = E('div', { 'class': 'zc-ob-desc' }, [ _('Checking onboarding readiness...') ]);
			var readinessList = E('ul', { 'style': 'margin:12px 0 0 18px; line-height:1.8; color:#334155;' }, []);
			var warningsBadge = E('span', { 'class': 'zc-ob-badge zc-ob-running' }, [ _('No configuration warnings detected') ]);
			var warningsSummary = E('div', { 'class': 'zc-ob-desc' }, [ _('Checking configuration consistency...') ]);
			var warningsList = E('ul', { 'style': 'margin:12px 0 0 18px; line-height:1.8; color:#334155;' }, []);
			var currentSummary = E('div', { 'class': 'zc-ob-summary' }, [ _('Loading current configuration summary...') ]);
		var renderedConfig = E('pre', { 'class': 'zc-ob-console' }, [ _('Click Render config to generate the runtime TOML preview.') ]);
		var commandOutput = E('pre', { 'class': 'zc-ob-console' }, [ _('Run a common command to inspect the latest result here.') ]);

		var m = new form.Map('zeroclaw', _('ZeroClaw Onboarding'), _('Complete the initial ZeroClaw setup in LuCI: fill in the required provider settings, render the generated config, then enable and start the service.'));

		var s = m.section(form.NamedSection, 'main', 'zeroclaw', _('Quick Start'));
		s.anonymous = true;

		var o = s.option(form.Flag, 'enabled', _('Enable service after setup'));
		o.rmempty = false;

		o = s.option(form.Value, 'provider', _('Provider'));
		o.placeholder = 'openrouter';
		o.rmempty = false;
		o.description = _('Set the default provider used by ZeroClaw for its generated runtime configuration.');

		o = s.option(form.Value, 'model', _('Model'));
		o.placeholder = 'anthropic/claude-sonnet-4-6';
		o.rmempty = false;
		o.description = _('Set the default model for the selected provider.');

		o = s.option(form.Value, 'api_key', _('API key'));
		o.password = true;
		o.rmempty = true;
		o.description = _('Provide the API key required by the configured provider.');

		o = s.option(form.Value, 'api_base', _('API base URL'));
		o.placeholder = 'https://api.example.com/v1';
		o.description = _('Optional custom upstream API endpoint. Leave empty to use the provider default.');

		o = s.option(form.Value, 'workspace', _('Workspace'));
		o.placeholder = '/var/lib/zeroclaw';
		o.rmempty = false;
		o.description = _('Directory used as ZeroClaw HOME and workspace state path.');

		o = s.option(form.Value, 'host', _('Listen host'));
		o.datatype = 'ipaddr("nomask")';
		o.placeholder = '127.0.0.1';
		o.rmempty = false;
		o.description = _('Keep this on 127.0.0.1 unless you explicitly want remote access.');

		o = s.option(form.Value, 'port', _('Listen port'));
		o.datatype = 'port';
		o.placeholder = '42617';
		o.rmempty = false;
		o.description = _('Listening port for the ZeroClaw daemon.');

		o = s.option(form.Flag, 'allow_public_bind', _('Allow public bind'));
		o.rmempty = false;
		o.description = _('Only enable this if you intentionally want the service to bind beyond localhost.');

		var adv = m.section(form.NamedSection, 'main', 'zeroclaw', _('Advanced Runtime Settings'));
		adv.anonymous = true;

		o = adv.option(form.ListValue, 'log_level', _('Log level'));
		[ 'trace', 'debug', 'info', 'warn', 'error' ].forEach(function(level) {
			o.value(level);
		});
		o.default = 'info';
		o.description = _('Controls the RUST_LOG level used by the init script.');

		return m.render().then(function(node) {
			function currentValue(key, fallback) {
				var value = uci.get('zeroclaw', 'main', key);
				return (value != null && value !== '') ? value : fallback;
			}

			function updateSummary() {
				var provider = currentValue('provider', '-');
				var model = currentValue('model', '-');
				var host = currentValue('host', '127.0.0.1');
				var port = currentValue('port', '42617');
				var workspace = currentValue('workspace', '/var/lib/zeroclaw');
				var apiBase = currentValue('api_base', _('Provider default'));
				var hasApiKey = currentValue('api_key', '') ? _('Configured') : _('Missing');

				currentSummary.innerHTML = '';
				currentSummary.appendChild(E('div', { 'class': 'zc-ob-summary-row' }, [ E('strong', {}, [ _('Provider') + ': ' ]), provider ]));
				currentSummary.appendChild(E('div', { 'class': 'zc-ob-summary-row' }, [ E('strong', {}, [ _('Model') + ': ' ]), model ]));
				currentSummary.appendChild(E('div', { 'class': 'zc-ob-summary-row' }, [ E('strong', {}, [ _('API key') + ': ' ]), hasApiKey ]));
				currentSummary.appendChild(E('div', { 'class': 'zc-ob-summary-row' }, [ E('strong', {}, [ _('API base URL') + ': ' ]), apiBase ]));
				currentSummary.appendChild(E('div', { 'class': 'zc-ob-summary-row' }, [ E('strong', {}, [ _('Listen address') + ': ' ]), host + ':' + port ]));
				currentSummary.appendChild(E('div', { 'class': 'zc-ob-summary-row' }, [ E('strong', {}, [ _('Workspace') + ': ' ]), workspace ]));
			}

			function updateReadiness() {
				var missing = [];
				var provider = currentValue('provider', '');
				var model = currentValue('model', '');
				var apiKey = currentValue('api_key', '');
				var workspace = currentValue('workspace', '');
				var host = currentValue('host', '');
				var port = currentValue('port', '');

				if (!provider)
					missing.push(_('Provider is not configured yet.'));
				if (!model)
					missing.push(_('Model is not configured yet.'));
				if (!apiKey)
					missing.push(_('API key is not configured yet.'));
				if (!workspace)
					missing.push(_('Workspace path is not configured yet.'));
				if (!host)
					missing.push(_('Listen host is not configured yet.'));
				if (!port)
					missing.push(_('Listen port is not configured yet.'));

				readinessList.innerHTML = '';

				if (missing.length === 0) {
					readinessBadge.className = 'zc-ob-badge zc-ob-running';
					readinessBadge.textContent = _('Ready for service startup');
					readinessSummary.textContent = _('The essential onboarding fields are configured. You can render the config and start the service from this page.');
					readinessList.appendChild(E('li', {}, [ _('No required fields are missing in the current UCI configuration.') ]));
				}
				else {
					readinessBadge.className = 'zc-ob-badge zc-ob-pending';
					readinessBadge.textContent = _('Onboarding is incomplete');
					readinessSummary.textContent = _('The following items still need attention before ZeroClaw is fully ready:');
					missing.forEach(function(item) {
						readinessList.appendChild(E('li', {}, [ item ]));
					});
				}
			}

			function updateWarnings() {
				var warnings = [];
				var provider = currentValue('provider', '');
				var model = currentValue('model', '');
				var apiKey = currentValue('api_key', '');
				var workspace = currentValue('workspace', '');
				var host = currentValue('host', '127.0.0.1');
				var allowPublicBind = currentValue('allow_public_bind', '0');
				var logLevel = currentValue('log_level', 'info');

				warningsList.innerHTML = '';

				if (provider && !model)
					warnings.push(_('A provider is configured but no default model is set yet.'));
				if ((provider || model) && !apiKey)
					warnings.push(_('Provider or model is configured, but the API key is still missing.'));
				if (allowPublicBind === '1' && host === '127.0.0.1')
					warnings.push(_('Public bind is enabled, but the host is still 127.0.0.1. Check whether this matches your real exposure intent.'));
				if (host !== '127.0.0.1')
					warnings.push(_('The listen host is not localhost. Confirm that your firewall policy and network exposure are intentional.'));
				if (workspace && workspace !== '/var/lib/zeroclaw' && workspace.indexOf('/tmp/') === 0)
					warnings.push(_('The workspace is under /tmp, which is usually volatile and not suitable for persistent runtime state.'));
				if (logLevel === 'debug' || logLevel === 'trace')
					warnings.push(_('The current log level is verbose. This is useful for troubleshooting, but it is usually not recommended for long-term daily use.'));

				if (warnings.length === 0) {
					warningsBadge.className = 'zc-ob-badge zc-ob-running';
					warningsBadge.textContent = _('No configuration warnings detected');
					warningsSummary.textContent = _('No obvious configuration inconsistencies were detected from the current UCI values.');
					warningsList.appendChild(E('li', {}, [ _('The current configuration looks internally consistent from the LuCI side.') ]));
				}
				else {
					warningsBadge.className = 'zc-ob-badge zc-ob-pending';
					warningsBadge.textContent = _('Configuration warnings detected');
					warningsSummary.textContent = _('The following items may not block startup outright, but they are worth reviewing before you rely on this setup:');
					warnings.forEach(function(item) {
						warningsList.appendChild(E('li', {}, [ item ]));
					});
				}
			}

			function setStatus(running) {
				statusBadge.className = 'zc-ob-badge ' + (running ? 'zc-ob-running' : 'zc-ob-stopped');
				statusBadge.textContent = running ? _('Service is running') : _('Service is stopped');
			}

			function refreshStatus() {
				return callServiceList('zeroclaw').then(function(res) {
					setStatus(serviceRunning(res));
				}).catch(function() {
					statusBadge.className = 'zc-ob-badge zc-ob-stopped';
					statusBadge.textContent = _('Unable to read status');
				});
			}

			function renderConfigPreview() {
				renderedConfig.textContent = _('Rendering config...');
				return execText('/usr/libexec/zeroclaw/render-config.sh', []).then(function() {
					return execText('/bin/cat', [ '/etc/zeroclaw/config.toml' ]);
				}).then(function(output) {
					renderedConfig.textContent = (output || '').trim() || _('No rendered config output.');
				}).catch(function(err) {
					renderedConfig.textContent = _('Config render failed: ') + err;
				});
			}

			function runAction(cmd, args, successPrefix, failurePrefix) {
				commandOutput.textContent = _('Running command...');
				return execText(cmd, args).then(function(output) {
					commandOutput.textContent = (output || '').trim() || successPrefix;
					return refreshStatus();
				}).catch(function(err) {
					commandOutput.textContent = failurePrefix + err;
				});
			}

			node.appendChild(E('div', { 'class': 'zc-ob-wrap' }, [
				E('style', {}, [
					'.zc-ob-wrap{margin-top:16px;}' +
					'.zc-ob-card{border:1px solid #e5e7eb;border-radius:8px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.04);margin-bottom:16px;overflow:hidden;}' +
					'.zc-ob-head{padding:12px 18px;border-bottom:1px solid #eef2f7;font-weight:600;color:#334155;background:#f8fafc;}' +
					'.zc-ob-body{padding:16px 18px;}' +
					'.zc-ob-desc{font-size:13px;color:#64748b;line-height:1.6;margin-bottom:12px;}' +
					'.zc-ob-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px 16px;font-size:13px;color:#334155;line-height:1.7;}' +
					'.zc-ob-summary-row{padding:10px 12px;border:1px solid #eef2f7;border-radius:6px;background:#f8fafc;word-break:break-word;}' +
					'.zc-ob-actions{display:flex;gap:8px;flex-wrap:wrap;}' +
					'.zc-ob-badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600;}' +
					'.zc-ob-running{background:#e8f7ea;color:#1a7f37;}' +
					'.zc-ob-stopped{background:#ffeef0;color:#cf222e;}' +
					'.zc-ob-pending{background:#fff8db;color:#9a6700;}' +
					'.zc-ob-console{margin:0;white-space:pre-wrap;max-height:24rem;overflow:auto;background:#111827;color:#dbe4f0;border-radius:6px;padding:14px 16px;line-height:1.6;}'
				]),
				E('div', { 'class': 'zc-ob-card' }, [
					E('div', { 'class': 'zc-ob-head' }, [ _('Current Configuration Summary') ]),
					E('div', { 'class': 'zc-ob-body' }, [
						E('div', { 'class': 'zc-ob-desc' }, [ _('This summary reflects the current UCI values already stored for ZeroClaw.') ]),
						currentSummary
					])
				]),
				E('div', { 'class': 'zc-ob-card' }, [
					E('div', { 'class': 'zc-ob-head' }, [ _('Recommended Setup Advice') ]),
					E('div', { 'class': 'zc-ob-body' }, [
						E('div', { 'class': 'zc-ob-desc' }, [ _('Use these suggestions as a safe starting point for router deployments. They are based on the current package defaults and OpenWrt-facing integration assumptions.') ]),
						E('ul', { 'style': 'margin:0 0 0 18px; line-height:1.8; color:#334155;' }, [
							E('li', {}, [ _('Keep the listen host on 127.0.0.1 unless you really need access from other machines.') ]),
							E('li', {}, [ _('Prefer a stable provider/model pair first, then change one variable at a time when debugging.') ]),
							E('li', {}, [ _('Use /var/lib/zeroclaw unless you have a different persistent storage path prepared.') ]),
							E('li', {}, [ _('Keep the log level at info for daily use, and temporarily switch to debug only while troubleshooting.') ])
						])
					])
				]),
				E('div', { 'class': 'zc-ob-card' }, [
					E('div', { 'class': 'zc-ob-head' }, [ _('Security Notes') ]),
					E('div', { 'class': 'zc-ob-body' }, [
						E('div', { 'class': 'zc-ob-desc' }, [ _('These settings affect how widely the service is exposed on your router. Review them carefully before enabling remote access.') ]),
						E('ul', { 'style': 'margin:0 0 0 18px; line-height:1.8; color:#334155;' }, [
							E('li', {}, [ _('If you enable public bind, ZeroClaw may listen beyond localhost depending on the configured host and runtime behavior.') ]),
							E('li', {}, [ _('Avoid exposing provider credentials through screenshots, shared backups, or exported config files.') ]),
							E('li', {}, [ _('After changing bind-related settings, render the config again and verify the final generated TOML before restarting the service.') ])
						])
					])
				]),
				E('div', { 'class': 'zc-ob-card' }, [
					E('div', { 'class': 'zc-ob-head' }, [ _('Onboarding Checklist') ]),
					E('div', { 'class': 'zc-ob-body' }, [
						E('div', { 'class': 'zc-ob-desc' }, [ _('Recommended flow: save the provider settings above, render the generated runtime config, then enable and start the service. Use the common commands below to verify everything from LuCI.') ]),
						statusBadge,
						E('div', { 'style': 'margin-top:10px' }, [ readinessBadge ]),
						E('div', { 'style': 'margin-top:12px' }, [ readinessSummary ]),
						readinessList,
						E('div', { 'style': 'margin-top:12px;font-size:13px;color:#64748b;' }, [ _('After changing values in this form, click Save & Apply first so the summary and readiness check reflect the latest UCI state.') ]),
						E('ul', { 'style': 'margin:12px 0 0 18px; line-height:1.8; color:#334155;' }, [
							E('li', {}, [ _('Fill in provider, model, API key, and workspace settings.') ]),
							E('li', {}, [ _('Save & Apply the form to write UCI values.') ]),
							E('li', {}, [ _('Render the runtime config and review the generated TOML preview.') ]),
							E('li', {}, [ _('Enable boot and start or restart the service.') ]),
							E('li', {}, [ _('Run status or doctor commands if you need troubleshooting details.') ])
						])
					])
				]),
				E('div', { 'class': 'zc-ob-card' }, [
					E('div', { 'class': 'zc-ob-head' }, [ _('Configuration Consistency Check') ]),
					E('div', { 'class': 'zc-ob-body' }, [
						warningsBadge,
						E('div', { 'style': 'margin-top:12px' }, [ warningsSummary ]),
						warningsList
					])
				]),
				E('div', { 'class': 'zc-ob-card' }, [
					E('div', { 'class': 'zc-ob-head' }, [ _('Common Actions') ]),
					E('div', { 'class': 'zc-ob-body' }, [
						E('div', { 'class': 'zc-ob-desc' }, [ _('These actions only expose commands already supported by the current package: config render, init script control, status, and doctor.') ]),
						E('div', { 'class': 'zc-ob-actions' }, [
							E('button', {
								'class': 'btn cbi-button cbi-button-action',
								'click': ui.createHandlerFn(this, function() { return renderConfigPreview(); })
							}, [ _('Render config') ]),
							E('button', {
								'class': 'btn cbi-button',
								'click': ui.createHandlerFn(this, function() { return runAction('/etc/init.d/zeroclaw', [ 'enable' ], _('Boot enabled.'), _('Enable boot failed: ')); })
							}, [ _('Enable boot') ]),
							E('button', {
								'class': 'btn cbi-button',
								'click': ui.createHandlerFn(this, function() { return runAction('/etc/init.d/zeroclaw', [ 'start' ], _('Service start command completed.'), _('Start failed: ')); })
							}, [ _('Start service') ]),
							E('button', {
								'class': 'btn cbi-button cbi-button-apply',
								'click': ui.createHandlerFn(this, function() { return runAction('/etc/init.d/zeroclaw', [ 'restart' ], _('Service restart command completed.'), _('Restart failed: ')); })
							}, [ _('Restart service') ]),
							E('button', {
								'class': 'btn cbi-button',
								'click': ui.createHandlerFn(this, function() { return runAction('/usr/bin/zeroclaw', [ 'status' ], _('Status command completed.'), _('Status failed: ')); })
							}, [ _('Run status') ]),
							E('button', {
								'class': 'btn cbi-button',
								'click': ui.createHandlerFn(this, function() { return runAction('/usr/bin/zeroclaw', [ 'doctor' ], _('Doctor command completed.'), _('Doctor failed: ')); })
							}, [ _('Run doctor') ])
						]),
						E('div', { 'style': 'margin-top:16px' }, [ commandOutput ])
					])
				]),
				E('div', { 'class': 'zc-ob-card' }, [
					E('div', { 'class': 'zc-ob-head' }, [ _('Common Examples') ]),
					E('div', { 'class': 'zc-ob-body' }, [
						E('div', { 'class': 'zc-ob-desc' }, [ _('These examples are only convenience references for common onboarding combinations. Adjust them to match your actual provider and model choices.') ]),
						E('div', { 'class': 'zc-ob-summary' }, [
							E('div', { 'class': 'zc-ob-summary-row' }, [
								E('strong', {}, [ _('Provider') + ': ' ]), 'openrouter', E('br'),
								E('strong', {}, [ _('Model') + ': ' ]), 'anthropic/claude-sonnet-4-6', E('br'),
								E('strong', {}, [ _('API base URL') + ': ' ]), _('Provider default')
							]),
							E('div', { 'class': 'zc-ob-summary-row' }, [
								E('strong', {}, [ _('Provider') + ': ' ]), 'openai', E('br'),
								E('strong', {}, [ _('Model') + ': ' ]), 'gpt-4.1', E('br'),
								E('strong', {}, [ _('API base URL') + ': ' ]), 'https://api.openai.com/v1'
							]),
							E('div', { 'class': 'zc-ob-summary-row' }, [
								E('strong', {}, [ _('Provider') + ': ' ]), 'anthropic', E('br'),
								E('strong', {}, [ _('Model') + ': ' ]), 'claude-sonnet-4-5', E('br'),
								E('strong', {}, [ _('API base URL') + ': ' ]), 'https://api.anthropic.com'
							])
						])
					])
				]),
				E('div', { 'class': 'zc-ob-card' }, [
					E('div', { 'class': 'zc-ob-head' }, [ _('Rendered Config Preview') ]),
					E('div', { 'class': 'zc-ob-body' }, [
						E('div', { 'class': 'zc-ob-desc' }, [ _('This preview is generated by the package renderer at /usr/libexec/zeroclaw/render-config.sh and reflects the current UCI values after Save & Apply.') ]),
						renderedConfig
					])
				])
			]));

			poll.add(function() {
				return refreshStatus();
			});

			updateSummary();
			updateReadiness();
			updateWarnings();
			refreshStatus();
			return node;
		});
	}
});

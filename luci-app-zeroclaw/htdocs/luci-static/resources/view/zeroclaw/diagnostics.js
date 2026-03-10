'use strict';
'require fs';
'require ui';
'require view';

function execText(cmd, args) {
	return L.resolveDefault(fs.exec_direct(cmd, args || [], 'text'), '');
}

return view.extend({
	render: function() {
		var doctorBody = E('pre', { 'class': 'zc-console' }, [ _('Click Run doctor to collect diagnostics.') ]);
		var logBody = E('pre', { 'class': 'zc-console' }, [ _('Loading logs...') ]);

		function refreshLogs() {
			return execText('/sbin/logread', []).then(function(output) {
				var text = (output || '').trim();
				var lines = text ? text.split('\n').filter(function(line) {
					return line.toLowerCase().indexOf('zeroclaw') >= 0;
				}) : [];

				if (lines.length > 100)
					lines = lines.slice(lines.length - 100);

				logBody.textContent = lines.length ? lines.join('\n') : _('No ZeroClaw log lines found in logread.');
			}).catch(function(err) {
				logBody.textContent = _('Unable to read logs: ') + err;
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

		refreshLogs();

		return E('div', { 'class': 'zc-diagnostics' }, [
			E('style', {}, [
				'.zc-panel{border:1px solid #e5e7eb;border-radius:8px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.04);margin-bottom:16px;overflow:hidden;}' +
				'.zc-panel-head{padding:12px 18px;border-bottom:1px solid #eef2f7;font-weight:600;color:#334155;background:#f8fafc;}' +
				'.zc-panel-body{padding:16px 18px;}' +
				'.zc-panel-desc{font-size:13px;color:#64748b;line-height:1.6;margin-bottom:12px;}' +
				'.zc-console{margin:0;white-space:pre-wrap;max-height:24rem;overflow:auto;background:#111827;color:#dbe4f0;border-radius:6px;padding:14px 16px;line-height:1.6;}'
			]),
			E('div', { 'class': 'zc-panel' }, [
				E('div', { 'class': 'zc-panel-head' }, [ _('Diagnostics') ]),
				E('div', { 'class': 'zc-panel-body' }, [
				E('div', { 'class': 'zc-panel-desc' }, [ _('Use this page when ZeroClaw does not start cleanly, behaves unexpectedly, or needs deeper troubleshooting details from doctor output and recent logs.') ]),
					E('div', {}, [
						E('button', {
							'class': 'btn cbi-button cbi-button-action',
							'click': ui.createHandlerFn(this, function() { return runDoctor(); })
						}, [ _('Run doctor') ]),
						E('button', {
							'class': 'btn cbi-button',
							'style': 'margin-left:8px',
							'click': ui.createHandlerFn(this, function() { return refreshLogs(); })
						}, [ _('Refresh logs') ])
					]),
					E('div', { 'style': 'margin-top:16px' }, [ doctorBody ])
				])
			]),
			E('div', { 'class': 'zc-panel' }, [
				E('div', { 'class': 'zc-panel-head' }, [ _('Recent Logs') ]),
				E('div', { 'class': 'zc-panel-body' }, [ logBody ])
			])
		]);
	}
});

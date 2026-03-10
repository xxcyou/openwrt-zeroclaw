'use strict';
'require form';
'require uci';
'require view';

return view.extend({
	load: function() {
		return uci.load('zeroclaw');
	},

	render: function() {
		var m, s, o;

		m = new form.Map('zeroclaw', _('ZeroClaw Settings'), _('Configure the ZeroClaw runtime and provider-related options.'));

		m.description = _('This page exposes the full UCI-backed ZeroClaw settings. For first-time setup, you can start in the Onboarding page; for ongoing maintenance, use this page to fine-tune runtime behavior.');

		s = m.section(form.NamedSection, 'main', 'zeroclaw', _('Basic Settings'));
		s.anonymous = true;
		s.description = _('These options control how the ZeroClaw daemon listens, where it stores runtime state, and whether it should be enabled by default.');

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.rmempty = false;
		o.description = _('Enable or disable the service in UCI. The init script only starts ZeroClaw when this option is enabled.');

		o = s.option(form.Value, 'host', _('Listen host'));
		o.datatype = 'ipaddr("nomask")';
		o.placeholder = '127.0.0.1';
		o.rmempty = false;
		o.description = _('Recommended default: 127.0.0.1. Change this only if you intentionally want to expose the service beyond localhost.');

		o = s.option(form.Value, 'port', _('Listen port'));
		o.datatype = 'port';
		o.placeholder = '42617';
		o.rmempty = false;
		o.description = _('Daemon listen port. Make sure it does not conflict with other local services.');

		o = s.option(form.Flag, 'allow_public_bind', _('Allow public bind'));
		o.rmempty = false;
		o.description = _('Keep this disabled unless you have reviewed the exposure risk and really want binding beyond localhost.');

		o = s.option(form.Value, 'workspace', _('Workspace'));
		o.placeholder = '/var/lib/zeroclaw';
		o.rmempty = false;
		o.description = _('Recommended default: /var/lib/zeroclaw. This path is used as HOME and as the rendered workspace state directory.');

		o = s.option(form.ListValue, 'log_level', _('Log level'));
		[ 'trace', 'debug', 'info', 'warn', 'error' ].forEach(function(level) {
			o.value(level);
		});
		o.default = 'info';
		o.description = _('Recommended default: info. Use debug or trace temporarily while diagnosing issues.');

		s = m.section(form.NamedSection, 'main', 'zeroclaw', _('Provider Settings'));
		s.anonymous = true;
		s.description = _('These options feed the package renderer and become part of the generated ZeroClaw runtime TOML configuration.');

		o = s.option(form.Value, 'provider', _('Provider'));
		o.placeholder = 'openrouter';
		o.rmempty = false;
		o.description = _('Example values: openrouter, openai, anthropic. Keep provider and model aligned.');

		o = s.option(form.Value, 'api_base', _('API base URL'));
		o.placeholder = 'https://api.example.com/v1';
		o.description = _('Optional override for the upstream API endpoint. Leave empty when the provider default is sufficient.');

		o = s.option(form.Value, 'model', _('Model'));
		o.placeholder = 'anthropic/claude-sonnet-4-6';
		o.description = _('Set the default model to be written into the generated runtime config.');

		o = s.option(form.Value, 'api_key', _('API key'));
		o.password = true;
		o.rmempty = true;
		o.description = _('Provider credential used by the generated config. Avoid sharing screenshots or backups with this value exposed.');

		return m.render();
	}
});

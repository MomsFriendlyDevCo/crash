var _ = require('lodash');
var colors = require('chalk');
var fspath = require('path');

var crash = {
	defaults: {
		// Options used by crash.trace()
		logger: console.log,
		prefix: 'ERROR',
		colors: {
			message: colors.reset,
			prefix: colors.bgRed.bold,
			tree: colors.red,
			function: colors.yellowBright,
			seperator: colors.grey,
			native: colors.grey,
			path: colors.cyan,
			linePrefix: colors.grey,
			line: colors.cyan,
			column: colors.cyan,
		},
		text: {
			prefixSeperator: ':',
			tree: '├',
			treeFirst: '├',
			treeLast: '└',
			seperator: ' @ ',
		},

		// Options used by crash.decode()
		parsers: [
			{match: /^(?<path>.+?):(?<line>[0-9]+)$/, res: groups => ({...groups, type: 'path'})},
			{match: /^\s+at (?<callee>.+?) \((?<path>.+?):(?<line>[0-9]+):(?<column>[0-9]+)\)$/, res: groups => ({...groups, type: 'native'})},
			{match: /^\s*at (?<callee>.+?) \(<anonymous>\)$/, res: groups => ({...groups, type: 'native'})},
			{match: /^\s*at (?<callee>.+?) \((?<path>.+?):(?<line>[0-9]+):(?<column>[0-9]+)\)$/, res: groups => ({...groups, type: 'path'})},
		],
		ignorePaths: [
			/^internal\/modules\/cjs/,
		],
		filterUnknown: true,
		supportBabel: true,
	},


	/**
	* Output an error with a nice colored stack trace
	* This printer ignores any of the RegEx's in app.log.error.ignorePaths
	* @param {Error} error The error to display
	* @param {Object} [options] Additional cutomization options
	* @param {function} [options.logger=console.log] Output device to use
	* @param {string} [options.prefix] Optional prefix to display
	* @param {Object <function>} [options.colors] Color functions to apply to various parts of the output trace
	* @param {boolean} [options.output=true] Write output directly to the specified output.logger, disable this to return the computed output instead
	* @returns {string} The STDERR ready output
	*/
	trace: (error, options) => {
		var settings = {
			output: true,
			...crash.defaults,
			...options,
		};

		var err = crash.decode(error, settings);

		if (settings.output == false) { // Replace logger with something that buffers the output and then returns it
			var buf = '';
			settings.logger = msg => buf += msg + '\n';
		}

		settings.logger.apply(crash, [
			settings.prefix && settings.colors.prefix(settings.prefix + settings.text.prefixSeperator),
			settings.colors.message(err.message),
		].filter(i => i));

		if (err.trace) err.trace.forEach((trace, traceIndex) => settings.logger(
			' ' + settings.colors.tree(
				traceIndex == 0 && err.trace.length > 1 ? settings.text.treeFirst
				: traceIndex == err.trace.length - 1 ? settings.text.treeLast
				: settings.text.tree
			)
			+ ' ' + settings.colors.function(trace.callee || 'SYNTAX')
			+ settings.colors.seperator(settings.text.seperator)
			+ (
				trace.isNative
				? settings.colors.native('native')
				: `${settings.colors.path(trace.path)} ${settings.colors.linePrefix('+')}${settings.colors.line(trace.line)}${trace.column ? ':' + settings.colors.column(trace.column) : ''}`
			)
		));

		if (!settings.output) return buf;
	},


	/**
	* Shorthand function to call trace without output enabled
	* @see trace()
	*/
	generate: (error, options) => crash.trace(error, {...options, output: false}),


	/**
	* Decode a string stack trace into its component parts
	* @param {Error} error The error object to decode
	* @param {Object} [options] Additional decoding options
	* @param {RegExp} [options.parseSplitterNative] How to decode native function lines
	* @param {RegExp} [options.parseSplitterFile] How to decode named function lines
	* @param {Array <RegExp>} [options.ignorePaths] RegExp matches for paths that should be ignored when tracing
	* @param {boolean} [options.filterUnknown=true] Filter garbage strack trace lines
	* @param {boolean} [options.supportBabel=true] Support decoding Babel parsing errors
	* @returns {Object} An object composed of `{message,trace}` where trace is a collection containing `{type, callee, path?, line? column?}`
	*/
	decode: (error, options) => {
		var settings = {
			...crash.defaults,
			...options,
		};

		if (settings.supportBabel && error.code && error.code == 'BABEL_PARSE_ERROR') {
			var babelParsed = /^(?<path>.+?): (?<message>.+) \((?<line>[0-9]+):(?<column>[0-9]+)\)/.exec(error.message);
			return {
				babelParsed,
				message: babelParsed.groups.message,
				trace: [{
					type: 'path',
					path: babelParsed.groups.path,
					line: parseInt(babelParsed.groups.line),
					column: parseInt(babelParsed.groups.column),
				}],
			};
		} else { // Assume standard error trace
			return {
				message: error && error.message ? error.message
					: error && error.toString() ? error.toString()
					: error ? error
					: 'Unknown error',
				trace: error && error.stack
					? error.stack
						.split(/\n/)
						.map((line, offset) => {
							var matchedResult;
							var matchedParser = settings.parsers.find(p => matchedResult = p.match.exec(line));

							if (matchedParser) {
								return matchedParser.res(matchedResult.groups);
							} else {
								return {callee: line, type: 'unknown'};
							}
						})
						.filter(trace =>
							trace.type == 'native'
							|| (!settings.filterUnknown && trace.type != 'unknown')
							|| (trace.type == 'path' && !settings.ignorePaths.every(re => re.test(trace.path)))
						)
					: undefined,
			};
		}
	},


	/**
	* Print a stack trace then immediately terminate the process, halting all execution
	* @param {Error} error The error object to print
	* @param {Object} [options] Additional customization options
	* @see crash.trace() for full options definitions
	*/
	stop: (error, options) => {
		crash.trace(error);
		process.exit(1);
	},
};
module.exports = crash;

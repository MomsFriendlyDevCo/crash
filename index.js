var _ = require('lodash');
var colors = require('chalk');
var fs = require('fs');
var fspath = require('path');

var crash = {
	defaults: {
		// Options used by crash.trace()
		logger: console.warn,
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
			lineNumber: colors.grey,
			lineNumberContext: colors.blue.bold,
			contextAbovePre: colors.grey,
			contextAbovePointer: colors.bold.blue,
			contextAbovePost: colors.grey,
			contextBelowPre: colors.grey,
			contextBelowPointer: colors.bold.blue,
			contextBelowPost: colors.grey,
		},
		text: {
			prefixSeperator: ':',
			tree: '├',
			treeFirst: '├',
			treeLast: '└',
			seperator: ' @ ',
			contextAbovePre: ' ',
			contextAbovePointer: 'v',
			contextAbovePost: ' ',
			contextBelowPre: ' ',
			contextBelowPointer: '^',
			contextBelowPost: ' ',
		},
		padding: {
			lineNumber: 5,
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
		context: {
			above: true,
			below: true,
			linesBefore: 1,
			linesAfter: 1,
			pathRewrite: path => path,
		},
	},


	/**
	* Output an error with a nice colored stack trace
	* This printer ignores any of the RegEx's in app.log.error.ignorePaths
	* @param {Error} error The error to display
	* @param {Object} [options] Additional cutomization options
	* @param {function} [options.logger=console.log] Output device to use
	* @param {string} [options.prefix] Optional prefix to display
	* @param {Object<function>|boolean} [options.colors] Color functions to apply to various parts of the output trace, if falsy colors are disabled
	* @param {boolean} [options.output=true] Write output directly to the specified output.logger, disable this to return the computed output instead
	* @returns {string} The STDERR ready output
	*/
	trace: (error, options) => {
		var settings = _.merge({}, crash.defaults, {output: true}, options);

		if (!settings.colors) settings.colors = _.mapValues(crash.defaults.colors, key => (...txt) => txt.join(' '));

		var err = crash.decode(error, settings);

		if (settings.output == false) { // Replace logger with something that buffers the output and then returns it
			var buf = '';
			settings.logger = msg => buf += msg + '\n';
		}


		// OUTPUT: Context line(s)
		if (err.trace && (settings.context.above || settings.context.below) && err.trace.length > 0 && err.trace[0].path && 'line' in err.trace[0]) {
			try {
				var contextFile = fs.readFileSync(settings.context.pathRewrite(err.trace[0].path), 'utf-8');
				contextFile
					.split(/\n/)
					.slice(err.trace[0].line - settings.context.linesBefore - 1, err.trace[0].line + settings.context.linesAfter)
					.forEach((line, offset) => {
						var isContext = offset == settings.context.linesBefore;

						// Above-line context indicator
						if (isContext && settings.context.above) {
							var start = err.trace[0].col || 0;
							var end = err.trace[0].length ? (err.trace[0].col || 0) + err.trace[0].length : line.length;

							// Calculate tab indent bias (so we can also indent the context above / below lines)
							var prefixTabs = /^(\t+)?/.exec(line)[1] || '';

							settings.logger(
								settings.colors.lineNumber(' '.repeat(settings.padding.lineNumber))
								+ settings.colors.contextAbovePre(prefixTabs)
								+ settings.colors.contextAbovePre(settings.text.contextAbovePre.repeat(start))
								+ settings.colors.contextAbovePointer(settings.text.contextAbovePointer.repeat(end - start))
								+ settings.colors.contextAbovePost(settings.text.contextAbovePost.repeat(end - line.length))
							);
						}

						// Output line
						settings.logger(
							('' + settings.colors[isContext ? 'lineNumberContext' : 'lineNumber'](err.trace[0].line + offset + settings.context.linesBefore)).padStart(settings.lineNumber)
							+ line
						);

						// Below-line context indicator
						if (isContext && settings.context.below) {
							var start = err.trace[0].col || 0;
							var end = err.trace[0].length ? (err.trace[0].col || 0) + err.trace[0].length : line.length;

							settings.logger(
								settings.colors.lineNumber(' '.repeat(settings.padding.lineNumber))
								+ settings.colors.contextBelowPre(prefixTabs)
								+ settings.colors.contextBelowPre(settings.text.contextBelowPre.repeat(start))
								+ settings.colors.contextBelowPointer(settings.text.contextBelowPointer.repeat(end - start))
								+ settings.colors.contextBelowPost(settings.text.contextBelowPost.repeat(end - line.length))
							);
						}
					});
			} catch (e) { // Ignore if source file cannot be read
				// Pass
			}
		}


		// OUTPUT: Error message line + start of trace
		settings.logger.apply(crash, [
			settings.prefix && settings.colors.prefix(settings.prefix + settings.text.prefixSeperator),
			settings.colors.message(err.message),
		].filter(i => i));


		// OUTPUT: Trace stack
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

		var babelParsed;
		if (settings.supportBabel && error && error.code && error.code == 'BABEL_PARSE_ERROR' && (babelParsed = /^(?<path>.+?): (?<message>.+) \((?<line>[0-9]+):(?<column>[0-9]+)\)/.exec(error.message))) {
			return {
				babelParsed,
				message: babelParsed.groups.message,
				trace: [{
					type: 'path',
					path: babelParsed.groups.path,
					line: parseInt(babelParsed.groups.line) + 1,
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
								var resolved = matchedParser.res(matchedResult.groups);
								['line', ' col'].forEach(f => {
									if (resolved[f]) resolved[f] = +resolved[f];
								})
								return resolved;
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

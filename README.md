@MomsFriendlyDevCo/Crash
========================
Nicer error reporting with colors and blackboxing.


```javascript
var crash = require('@momsfriendlydevco/crash');

crash.trace(new Error('Nope!'));
```


API
===

crash.trace(error, options)
---------------------------
Output an error or string with colors and stack tracing.


crash.generate(error, options)
------------------------------
Shorthand function for calling trace with `{output: false}` as a default option.
Use this if only the raw text (ANSI wrapped if `{colors: true}`) is required but _not_ to be immediately output to STDERR.


crash.stop(error, options)
--------------------------
Similar to `crash.trace()` but immediately terminate the process, halting all execution


crash.decode(error, options)
----------------------------
Decode a string stack trace into its component parts.


crash.defaults
--------------
Default options when rendering.


Valid options are:

| Option                | Type       | Default        | Description                                                    |
|-----------------------|------------|----------------|----------------------------------------------------------------|
| `logger`              | `function` | `console.warn` | Actual outputter, used when writing the error                  |
| `prefix`              | `string`   | `"ERROR"`      | Prefix string used when outputting the error                   |
| `colors`              | `object`   | See code       | Lookup object of colors used for each part of an error message |
| `text`                | `object`   | See code       | Various text strings used in error messages                    |
| `ignorePaths`         | `RegExp`   | See code       | Path RegExps to blackbox (remove from trace output)            |
| `filterUnknown`       | `boolean`  | `true`         | Filter out grarbage stack trace lines                          |
| `parsers`             | `array <Object>` | See code | Collection of parsers, which are executed in order until one matches |
| `supportBabel`        | `boolean`  | `true`         | Add support for decoding Babel parser errors                   |

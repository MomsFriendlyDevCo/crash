var crash = require('..');
var expect = require('chai').expect;

describe('crash', ()=> {

	it('should report simple errors', ()=>
		crash.trace(new Error('This is an error'))
	)

	it('should generate output with color disabled', ()=> {
		var output = crash.generate(new Error('This is an error'), {colors: false})
	})

	it('should cope with string input', ()=>
		crash.trace('This is a string error')
	)

});

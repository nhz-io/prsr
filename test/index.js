/* eslint-disable func-names, no-invalid-this, no-magic-numbers */
const test = require('ava')
const Parser = require('..')

const pkg = require('../package.json')

test('Parser constructor', t => {
    t.true(new Parser({}) instanceof Parser)
})

test('Parser.parsePath', t => {
    t.deepEqual(Parser.parsePath('/foo/!bar/*/1'), [
        {root: true},
        {re: /^foo$/, inv: false},
        {re: /^bar$/, inv: true},
        {re: /.*/, inv: false},
        {re: /^1$/, inv: false},
    ])
})

test('Parser#match', t => {
    const parser = new Parser({'/foo/!bar/1/*/foobar': null})

    let test = [
        {root: true},
        {inv: false, re: /^foo$/},  
        {inv: true, re: /^bar$/},  
        {inv: false, re: /^1$/},  
        {inv: false, re: /.*/},
        {inv: false, re: /^foobar$/},
        null,
    ]

    t.deepEqual(parser.match(), [test])

    t.deepEqual(parser.match('foo', [test.slice(1)]), [test.slice(1)])

    t.deepEqual(parser.match('not bar', [test.slice(2)]), [test.slice(2)])

    t.deepEqual(parser.match('1', [test.slice(3)]), [test.slice(3)])

    t.deepEqual(parser.match('whatever', [test.slice(4)]), [test.slice(4)])    

    t.deepEqual(parser.match('foobar', [test.slice(5)]), [test.slice(5)])
})

test('Parser#_handle', t => {
    t.plan(9)

    const ctx = {}

    const test = {foo: {'not bar': {'anything': ['nothing', {test: 'pass'}]}}}

    const parser = new Parser({'/foo/!bar/*/1': (id, item, context) => {
        t.is(id, 1)
        t.deepEqual(item, {test: 'pass'})
        t.is(context, ctx)
    }})

    const visitors = parser.visitors

    let unhandled
    
    unhandled = parser._handle(null, test, ctx, parser.visitors)
    t.deepEqual(
        unhandled[0].slice(0, unhandled[0].length - 1), 
        visitors[0].slice(1, visitors[0].length - 1)
    )

    unhandled = parser._handle('foo', test.foo, ctx, unhandled)
    t.deepEqual(
        unhandled[0].slice(0, unhandled[0].length - 1), 
        visitors[0].slice(2, visitors[0].length - 1)
    )

    unhandled = parser._handle('not bar', test.foo['not bar'], ctx, unhandled)
    t.deepEqual(
        unhandled[0].slice(0, unhandled[0].length - 1), 
        visitors[0].slice(3, visitors[0].length - 1)
    )

    unhandled = parser._handle('anything', test.foo['not bar'].anything, ctx, unhandled)
    t.deepEqual(
        unhandled[0].slice(0, unhandled[0].length - 1), 
        visitors[0].slice(4, visitors[0].length - 1)
    )

    t.deepEqual(parser._handle(0, test.foo['not bar'].anything[0], ctx, unhandled), [])

    t.deepEqual(parser._handle(1, test.foo['not bar'].anything[1], ctx, unhandled), [])
})

test('Parser#_parse', t => {
    t.plan(6)

    const ctx = {}

    const test = {foo: {'not bar': {'anything': ['nothing', {test: 'pass'}]}}}

    const parser = new Parser({
        '/foo/!bar/*/0': (id, item, context) => {
            t.is(id, 0)
            t.is(item, 'nothing')
            t.is(context, ctx)
        },
        '/foo/!bar/*/1': (id, item, context) => {
            t.is(id, 1)
            t.deepEqual(item, {test: 'pass'})
            t.is(context, ctx)
        },
    })

    parser._parse(test, ctx, parser.visitors, true)
})

test('Parser#parse', t => {
    t.plan(6)

    const ctx = {}

    const test = {foo: {'not bar': {'anything': ['nothing', {test: 'pass'}]}}}

    const parser = new Parser({
        '/foo/!bar/*/0': (id, item, context) => {
            t.is(id, 0)
            t.is(item, 'nothing')
            t.is(context, ctx)
        },
        '/foo/!bar/*/1': (id, item, context) => {
            t.is(id, 1)
            t.deepEqual(item, {test: 'pass'})
            t.is(context, ctx)
        },
    })

    parser.parse(test, ctx)
})

test('parse package.json', t => {
    t.plan(5)

    const parser = new Parser({
        '/scripts/start': (id, value) => t.is(value, pkg.scripts.start),
        'prepublish': (id, value) => t.is(value, pkg.scripts.prepublish),
        '/*/prepush': (id, value) => t.is(value, pkg.scripts.prepush),
        '*/coveralls': (id, value) => t.true(
            value === pkg.scripts.coveralls ||
            value === pkg.devDependencies.coveralls
        ),
    })

    parser.parse(pkg)
})

test('recompose objects', t => {
    class MyParser extends Parser {
        parse(data) {
            return super.parse(data, {result: {}}).result
        }
    }

    const fixture = [
        {
            id: 'foo', 
            props: [
                {name: 'name', value: 'foo name'},
                {name: 'value', value: 'FOO VALUE'},
            ],
        },
        {
            id: 'bar',
            props: [
                {name: 'name', value: 'bar name'},
                {name: 'value', value: 'BAR VALUE'},
            ],
        },
    ]

    const pass = {
        foo: {
            name: 'foo name',
            value: 'FOO VALUE',
        },
        bar: {
            name: 'bar name',
            value: 'BAR VALUE',
        },
    }

    const parser = new MyParser({
        '/\\d+': (id, data, context) => {
            context.obj = {}
        },
        '*/id': (id, data, context) => {
            context.result[data] = context.obj
        },
        '*/props/*': (id, data, context) => {
            context.obj[data.name] = data.value
        },
    })

    t.deepEqual(parser.parse(fixture), pass)
})

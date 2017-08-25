'use strict'

const head = arr => arr[0] // eslint-disable-line no-magic-numbers
const tail = arr => arr.slice(1) // eslint-disable-line no-magic-numbers
const uniq = arr => arr.filter((item, idx) => idx === arr.indexOf(item))

class Parser {
    constructor(visitors) {
        this.visitors = Object.keys(visitors).map(path => {
            const visitor = Parser.parsePath(path)
            visitor.push(visitors[path])

            return visitor
        })
    }

    match(key, visitors = this.visitors) {
        if (key === null || key === undefined) { // eslint-disable-line no-undefined
            return visitors.filter(([{root}]) => root)
        }

        return visitors.filter(([{re, inv}]) => 
            re && (Boolean(inv) ^ Boolean(`${key}`.match(re)))
        )
    }

    _handle(id, item, context, visitors) {
        return this.match(id, visitors).map(visitor => {
            visitor = tail(visitor)
            const handler = head(visitor)

            if (typeof handler !== 'function') {
                return visitor
            }

            handler(id, item, context)

            return null
        }).filter(i => i)
    }

    _parse(data, context, visitors, root = false) {
        if (typeof data !== 'object') {
            return context
        } 

        if (root) {
            visitors = this.match(null, visitors).map(tail)
        }

        const again = this.visitors.filter(([{root}]) => !root)

        if (Array.isArray(data)) {
            data.forEach((item, id) => {
                const cascade = this._handle(id, item, context, uniq([...visitors, ...again]))

                if (cascade.length) {
                    this._parse(item, context, cascade)
                }
            })
        }
        else {
            Object.keys(data).forEach(key => {
                const cascade = this._handle(key, data[key], context, uniq([...visitors, ...again]))

                if (cascade.length) {
                    this._parse(data[key], context, cascade)
                }
            })
        }

        return context
    }

    parse(data, context = {}, visitors = this.visitors) {
        return this._parse(data, context, visitors, true)
    }
}

Parser.parsePath = function parsePath(path) {
    return path.replace(/\/+/g, '/').replace(/\/+$/, '').split('/').map(k => {
        if (!k) {
            return {
                root: true,
            }
        }

        const [, inv, re] = k.match(/^(!?)([^!].*)$/)

        if (k === '*') {
            return {
                inv: false,
                re: new RegExp(`.*`),
            }
        }

        return {
            inv: Boolean(inv),
            re: new RegExp(re.replace(/^\^?/, '^').replace(/\$?$/, '$')),
        }
    })
}

module.exports = Parser

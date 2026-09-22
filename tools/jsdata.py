#!/usr/bin/env python3
"""Inline JS object/array literals ko Python data mein parse karta hai.

JSON.loads kaam nahi karta kyunki keys unquoted hain aur strings single-quoted.
"""
import re

class JSParse(Exception):
    pass

WS = ' \t\r\n'

def parse_literal(src, i=0):
    """src[i] se ek JS value parse karo. Returns (value, next_index)."""
    i = skip(src, i)
    c = src[i]
    if c == '{':
        obj, i = {}, i + 1
        while True:
            i = skip(src, i)
            if src[i] == '}':
                return obj, i + 1
            key, i = parse_key(src, i)
            i = skip(src, i)
            if src[i] != ':':
                raise JSParse('expected : at %d' % i)
            val, i = parse_literal(src, i + 1)
            obj[key] = val
            i = skip(src, i)
            if src[i] == ',':
                i += 1
            elif src[i] == '}':
                return obj, i + 1
            else:
                raise JSParse('bad object at %d' % i)
    if c == '[':
        arr, i = [], i + 1
        while True:
            i = skip(src, i)
            if src[i] == ']':
                return arr, i + 1
            val, i = parse_literal(src, i)
            arr.append(val)
            i = skip(src, i)
            if src[i] == ',':
                i += 1
            elif src[i] == ']':
                return arr, i + 1
            else:
                raise JSParse('bad array at %d' % i)
    if c in '"\'`':
        return parse_string(src, i)
    m = re.match(r'-?\d+(\.\d+)?([eE][+-]?\d+)?', src[i:])
    if m:
        t = m.group(0)
        return (float(t) if ('.' in t or 'e' in t.lower()) else int(t)), i + len(t)
    for lit, val in (('true', True), ('false', False), ('null', None), ('undefined', None)):
        if src.startswith(lit, i):
            return val, i + len(lit)
    raise JSParse('unexpected %r at %d' % (src[i:i+20], i))

def skip(src, i):
    while i < len(src):
        if src[i] in WS:
            i += 1
        elif src.startswith('//', i):
            i = src.find('\n', i)
            if i < 0:
                raise JSParse('eof in comment')
        elif src.startswith('/*', i):
            i = src.find('*/', i)
            if i < 0:
                raise JSParse('eof in comment')
            i += 2
        else:
            return i
    raise JSParse('eof')

def parse_key(src, i):
    if src[i] in '"\'':
        return parse_string(src, i)
    m = re.match(r'[A-Za-z_$][\w$]*', src[i:])
    if not m:
        raise JSParse('bad key at %d' % i)
    return m.group(0), i + len(m.group(0))

ESC = {'n': '\n', 't': '\t', 'r': '\r', 'b': '\b', 'f': '\f',
       '\\': '\\', '/': '/', "'": "'", '"': '"', '`': '`', '\n': ''}

def parse_string(src, i):
    q, i, out = src[i], i + 1, []
    while i < len(src):
        c = src[i]
        if c == '\\':
            nx = src[i+1]
            if nx == 'u':
                out.append(chr(int(src[i+2:i+6], 16))); i += 6; continue
            if nx == 'x':
                out.append(chr(int(src[i+2:i+4], 16))); i += 4; continue
            out.append(ESC.get(nx, nx)); i += 2; continue
        if c == q:
            return ''.join(out), i + 1
        out.append(c); i += 1
    raise JSParse('unterminated string')

def find_array(src, name):
    """`name=[ ... ]` ko dhoondh kar parse karo."""
    m = re.search(r'\b' + re.escape(name) + r'\s*=\s*\[', src)
    if not m:
        return None
    try:
        val, _ = parse_literal(src, m.end() - 1)
        return val
    except (JSParse, IndexError, ValueError):
        return None

(function(global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
        typeof define === 'function' && define.amd ? define(factory) :
            (global.preact = factory());
}
)(this, function() {
    'use strict';

    function VNode(nodeName, attributes, children) {
        /** @type {string|function<pure/Constructor>} */
        this.nodeName = nodeName;

        /** @type {object<string>|undefined} */
        this.attributes = attributes;

        /** @type {array<VNode>|undefined} */
        this.children = children;
    }

    var NO_RENDER = {
        render: false
    };
    var SYNC_RENDER = {
        renderSync: true
    };

    var EMPTY = {};
    var EMPTY_BASE = '';

    /** 浏览器环境.*/
    var HAS_DOM = typeof document !== 'undefined';
    var TEXT_CONTENT = (!HAS_DOM || 'textContent') in document ? 'textContent' : 'nodeValue';

    var ATTR_KEY = typeof Symbol !== 'undefined' ? Symbol('preactattr') : '__preactattr_';
    var UNDEFINED_ELEMENT = 'undefined';

    /** DOM属性值仅为数字的属性【没有单位 eg:px】.*/
    var NON_DIMENSION_PROPS = {
        boxFlex: 1,
        boxFlexGroup: 1,
        columnCount: 1,
        fillOpacity: 1,
        flex: 1,
        flexGrow: 1,
        flexPositive: 1,
        flexShrink: 1,
        flexNegative: 1,
        fontWeight: 1,
        lineClamp: 1,
        lineHeight: 1,
        opacity: 1,
        order: 1,
        orphans: 1,
        strokeOpacity: 1,
        widows: 1,
        zIndex: 1,
        zoom: 1
    };

    /** 从`props`中拷贝自有属性到`obj`【拷贝引用】.*/

    function extend(obj, props) {
        for (var i in props) {
            if (hasOwnProperty.call(props, i)) {
                obj[i] = props[i];
            }
        }
        return obj;
    }

    /** 快速克隆. 注意: 不会过滤掉非自有属性. */

    function clone(obj) {
        var out = {};
        for (var i in obj) {
            out[i] = obj[i];
        }
        return out;
    }

    /** 对于给定函数创建一个缓存包装.*/

    function memoize(fn, mem) {
        mem = mem || {};
        return function(k) {
            return hasOwnProperty.call(mem, k) ? mem[k] : mem[k] = fn(k);
        };
    }

    /** 从给定对象(obj)中获取深层属性值,用点号表述.*/

    function delve(obj, key) {
        for (var p = key.split('.'), i = 0; i < p.length && obj; i++) {
            obj = obj[p];
        }
        return obj;
    }

    /** 转换一个类似数组对象到数组中.*/

    function toArray(obj) {
        var arr = [],
            i = obj.length;
        while (i--) {
            arr[i] = obj[i];
        }
        return arr;
    }

    /** 判断给定对象(obj)是否是function.*/
    var isFunction = function(obj) {
        return 'function' === typeof obj;
    };

    /** 判断给定对象(obj)是否是string.*/
    var isString = function(obj) {
        return 'string' === typeof obj;
    };

    /** 安全指向内置hasOwnProperty.*/
    var hasOwnProperty = ({}).hasOwnProperty;

    /** 检查给定值(x)是否为：`null` or `undefined`.*/
    var empty = function(x) {
        return x == null;
    };

    var falsey = function(x) {
        return x === false || x == null;
    };

    /** 把一个表示styles的hashmap转换成CSSText形式的字符串.*/

    function styleObjToCss(s) {
        var str = '';
        for (var prop in s) {
            if (hasOwnProperty.call(s, prop)) {
                var val = s[prop];
                if (!empty(val)) {
                    str += jsToCss(prop);
                    str += ': ';
                    str += val;
                    if (typeof val === 'number' && !NON_DIMENSION_PROPS[prop]) {
                        str += 'px';
                    }
                    str += '; ';
                }
            }
        }
        return str;
    }

    /** 把一个表示classes的hashmap转换成className形式的字符串.*/

    function hashToClassName(c) {
        var str = '';
        for (var prop in c) {
            if (c[prop]) {
                if (str) {
                    str += ' ';
                }
                str += prop;
            }
        }
        return str;
    }

    /** 把一个(JavaScript使用的)驼峰形式CSS属性名转换成CSS属性名称.*/
    var jsToCss = memoize(function(s) {
        return s.replace(/([A-Z])/g, '-$1').toLowerCase();
    });

    /** 缓存String.prototype.toLowerCase方法.*/
    var toLowerCase = memoize(function(s) {
        return s.toLowerCase();
    });

    // For animations, rAF is vastly superior. However, it scores poorly on benchmarks :(
    var ch = false;
    try {
        ch = new MessageChannel();
    } catch(e) {
    }

    /** 尽可能快的异步调用方法f.*/
    var setImmediate = ch ? (function(f) {
        ch.port1.onmessage = f;
        ch.port2.postMessage('');
    }) : setTimeout;

    var inDocument = function(node) {
        while (node && node !== document) {
            node = node.parentNode;
        }
        return (node === document) ? true : false;
    };

    var options = {
        /** 如果`TRUE`，`prop`变化将同步触发组件更新.*/
        syncComponentUpdates: false,

        /** 处理所有新创建的VNodes.*/
        vnode: function(n) {
            var attrs = n.attributes;
            if (!attrs || isFunction(n.nodeName)) {
                return;
            }

            /** 把属性名className转成class.*/
            var p = attrs.className;
            if (p) {
                attrs['class'] = p;
                delete attrs.className;
            }
            if (attrs['class']) {
                normalize(attrs, 'class', hashToClassName);
            }
            if (attrs.style) {
                normalize(attrs, 'style', styleObjToCss);
            }
        }
    };

    function normalize(obj, prop, fn) {
        var v = obj[prop];
        if (v && !isString(v)) {
            obj[prop] = fn(v);
        }
    }

    /** 调用`options`中定义的钩子函数name.*/

    function optionsHook(name, a, b) {
        return hook(options, name, a, b);
    }

    /** 调用给定对象(obj)中定义的钩子函数name.*/

    function hook(obj, name, a, b, c) {
        var fn = obj[name];
        if (isFunction(fn)) {
            return obj[name](a, b, c);
        }
        return void(0);
    }

    var SHARED_TEMP_ARRAY = [];

    function h(nodeName, attributes) {
        var len = arguments.length,
            lastSimple = false,
            children,
            arr;

        if (len > 2) {
            children = [];
            for (var i = 2; i < len; i++) {
                var _p = arguments[i];
                if (falsey(_p)) {
                    continue;
                }
                if (_p.join) {
                    arr = _p;
                } else {
                    arr = SHARED_TEMP_ARRAY;
                    arr[0] = _p;
                }
                for (var j = 0; j < arr.length; j++) {
                    var child = arr[j],
                        simple = !falsey(child) && !(child instanceof VNode);
                    if (simple) {
                        child = String(child);
                    }
                    if (simple && lastSimple) {
                        children[children.length - 1] += child;
                    } else if (!falsey(child)) {
                        children.push(child);
                    }
                    lastSimple = simple;
                }
            }
        }

        if (attributes && attributes.children) {
            delete attributes.children;
        }

        var p = new VNode(nodeName, attributes || void(0), children || void(0));
        optionsHook('vnode', p);
        return p;
    }

    function createLinkedState(component, key, eventPath) {
        var path = key.split('.'),
            p0 = path[0],
            len = path.length;

        return function(event) {
            var _component$setState = {},
                node = this,
                state = component.state,
                stateRef = state,
                value;

            if (isString(eventPath)) {
                value = delve(event, eventPath);
                if (empty(value) && (node = node._component)) {
                    value = delve(node, eventPath);
                }
            } else {
                value = (node.nodeName + node.type).match(/^input(checkbox|radio)$/i) ? node.checked : node.value;
            }
            if (isFunction(value)) {
                value = value.call(node);
            }

            if (len > 1) {
                for (var i = 0; i < len - 1; i++) {
                    stateRef = stateRef[path[i]] || (stateRef[path[i]] = {});
                }
                stateRef[path[i]] = value;
                value = state[p0];
            }

            _component$setState[p0] = value;
            component.setState(_component$setState);
        };
    }

    function isFunctionalComponent(vnode) {
        var nodeName = vnode.nodeName;
        return isFunction(nodeName) && !nodeName.prototype.render;
    }

    function buildFunctionalComponent(vnode, context) {
        return vnode.nodeName(getNodeProps(vnode), context || EMPTY) || EMPTY_BASE;
    }

    function ensureNodeData(node) {
        return node[ATTR_KEY] || (node[ATTR_KEY] = {});
    }

    function getNodeType(node) {
        return node.nodeType;
    }

    function appendChildren(parent, children) {
        var len = children.length,
            many = len > 2,
            into = many ? document.createDocumentFragment() : parent;
        for (var i = 0; i < len; i++) {
            into.appendChild(children[i]);
        }
        if (many) {
            parent.appendChild(into);
        }
    }

    /** 检索一个已渲染节点的属性值*/

    function getAccessor(node, name, value, cache) {
        if (name === 'class') {
            return node.className;
        }
        if (name === 'style') {
            return node.style.cssText;
        }

        if (name !== 'type' && name in node) {
            return node[name];
        }
        var attrs = node[ATTR_KEY];
        if (cache !== false && attrs && hasOwnProperty.call(attrs, name)) {
            return attrs[name];
        }

        return value;
    }

    function setAccessor(node, name, value) {
        if (name === 'class') {
            node.className = value || '';
        } else if (name === 'style') {
            node.style.cssText = value || '';
        } else if (name === 'dangerouslySetInnerHTML') {
            if (value && value.__html) {
                node.innerHTML = value.__html;
            }
        } else if (name === 'key' || (name in node && name !== 'type')) {
            node[name] = value;
            if (falsey(value)) {
                node.removeAttribute(name);
            }
        } else {
            setComplexAccessor(node, name, value);
        }

        ensureNodeData(node)[name] = value;
    }

    function setComplexAccessor(node, name, value) {
        if (name.substring(0, 2) === 'on') {
            var _type = normalizeEventName(name),
                l = node._listeners || (node._listeners = {}),
                fn = !l[_type] ? 'add' :
                    !value ? 'remove' : null;

            if (fn) {
                node[fn + 'EventListener'](_type, eventProxy);
            }

            l[_type] = value;
        } else {
            var type = typeof value;
            if (falsey(value)) {
                node.removeAttribute(name);
            } else if (type !== 'function' && type !== 'object') {
                node.setAttribute(name, value);
            }
        }
    }

    /** 一个已代理钩子的事件处理程序的回调*/

    function eventProxy(event) {
        var fn = this._listeners[normalizeEventName(event.type)];
        if (fn) {
            return fn.call(this, optionsHook('event', event) || event);
        }
        return void(0);
    }

    var normalizeEventName = memoize(function(t) {
        return t.replace(/^on/i, '').toLowerCase();
    });

    function getNodeAttributes(node) {
        return node[ATTR_KEY] || getRawNodeAttributes(node) || EMPTY;
    }

    function getRawNodeAttributes(node) {
        var list = node.attributes;
        if (!list || !list.getNamedItem) {
            return list;
        }

        return getAttributesAsObject(list);
    }

    function getAttributesAsObject(list) {
        var attrs = {};
        for (var i = list.length; i--;) {
            var item = list[i];
            attrs[item.name] = item.value;
        }
        return attrs;
    }

    function isSameNodeType(node, vnode) {
        if (isFunctionalComponent(vnode)) {
            return true;
        }
        var nodeName = vnode.nodeName;
        if (isFunction(nodeName)) {
            return node._componentConstructor === nodeName;
        }
        if (getNodeType(node) === 3) {
            return isString(vnode);
        }
        return toLowerCase(node.nodeName) === nodeName;
    }

    function getNodeProps(vnode) {
        var props = clone(vnode.attributes),
            c = vnode.children;

        if (c) {
            props.children = c;
        }
        var defaultProps = vnode.nodeName.defaultProps;
        if (defaultProps) {
            for (var i in defaultProps) {
                if (hasOwnProperty.call(defaultProps, i) && !(i in props)) {
                    props[i] = defaultProps[i];
                }
            }
        }

        return props;
    }

    /** DOM节点缓存池,以nodeName.toUpperCase()为键*/
    var nodes = {};

    var normalizeName = memoize(function(name) {
        return name.toUpperCase();
    });

    function collectNode(node) {
        cleanNode(node);
        var name = normalizeName(node.nodeName),
            list = nodes[name];

        if (list) {
            list.push(node);
        } else {
            nodes[name] = [node];
        }
    }

    function createNode(nodeName) {
        var name = normalizeName(nodeName),
            list = nodes[name],
            node = list && list.pop() || document.createElement(nodeName);

        ensureNodeData(node);
        return node;
    }

    function cleanNode(node) {
        var p = node.parentNode;
        if (p) {
            p.removeChild(node);
        }
        if (getNodeType(node) === 3) {
            return;
        }
        if (!node[ATTR_KEY]) {
            node[ATTR_KEY] = getRawNodeAttributes(node);
        }

        node._component = node._componentConstructor = null;
    }

    function diff(dom, vnode, context) {
        var originalAttributes = vnode.attributes;

        while (isFunctionalComponent(vnode)) {
            vnode = buildFunctionalComponent(vnode, context);
        }

        if (isFunction(vnode.nodeName)) {
            return buildComponentFromVNode(dom, vnode, context);
        } else if (isString(vnode)) {
            if (dom) {
                var type = getNodeType(dom);
                if (type === 3) {
                    dom[TEXT_CONTENT] = vnode;
                    return dom;
                } else if (type === 1) {
                    collectNode(dom);
                }
            }
            return document.createTextNode(vnode);
        } else {
            var out = dom,
                nodeName = vnode.nodeName || UNDEFINED_ELEMENT;

            if (!dom) {
                out = createNode(nodeName);
            } else if (toLowerCase(dom.nodeName) !== nodeName) {
                out = createNode(nodeName);
                appendChildren(out, toArray(dom.childNodes)); //?dont understand! need this line?
                recollectNodeTree(dom);
            }

            innerDiffNode(out, vnode, context);
            diffAttributes(out, vnode);

            if (originalAttributes && originalAttributes.ref) {
                (out[ATTR_KEY].ref = originalAttributes.ref)(out);
            }
            return out;
        }
    }

    /** Apply child and attribute changes between a VNode and a DOM Node to the DOM. */

    function innerDiffNode(dom, vnode, context) {
        var len = dom.childNodes.length,
            childrenLen = 0,
            keyedLen = 0,
            children,
            keyed,
            key;

        if (len) {
            children = [];
            for (var idx = 0; idx < len; idx++) {
                var child = dom.childNodes[idx],
                    props = child._component && child._component.props;

                key = props ? props.key : getAccessor(child, 'key');
                if (!empty(key)) {
                    if (!keyed) {
                        keyed = {};
                    }
                    keyed[key] = child;
                    keyedLen++;
                } else {
                    children[childrenLen++] = child;
                }
            }
        }

        var vchildren = vnode.children,
            vlen = vchildren && vchildren.length;

        if (vlen) {
            for (var i = 0; i < vlen; i++) {
                var vchild = vchildren[i],
                    child2 = void(0);

                // attempt to find a node based on key matching
                if (keyedLen) {
                    var attrs = vchild.attributes;
                    key = attrs && attrs.key;
                    if (!empty(key) && hasOwnProperty.call(keyed, key)) {
                        child2 = keyed[key];
                        delete keyed[key];
                        keyedLen--;
                    }
                }

                // attempt to pluck a node of the same type from the existing children
                if (!child2 && childrenLen) {
                    for (var j = 0; j < childrenLen; j++) {
                        if (isSameNodeType(children[j], vchild)) {
                            child2 = children[j];
                            children.splice(j, 1);
                            childrenLen--;
                            break;
                        }
                    }
                }

                // morph the matched/found/created DOM child to match vchild (deep)
                child2 = diff(child2, vchild, context);

                if (dom.childNodes[i] !== child2) {
                    var next = dom.childNodes[i + 1];

                    if (next) {
                        dom.insertBefore(child2, next);
                    } else {
                        dom.appendChild(child2);
                    }
                }
            }
        }

        if (keyedLen) {
            for (key in keyed) {
                if (hasOwnProperty.call(keyed, key)) {
                    children[childrenLen++] = keyed[key];
                }
            }
        }

        // 移除游离的子节点
        if (childrenLen) {
            removeOrphanedChildren(children);
        }
    }

    /** 回收节点列表.unmountOnly：是否是组件回收周期*/

    function removeOrphanedChildren(children, unmountOnly) {
        for (var i = children.length; i--;) {
            var child = children[i];
            if (child) {
                recollectNodeTree(child, unmountOnly);
            }
        }
    }

    /** 回收整个node节点树.unmountOnly：是否是组件回收周期 */

    function recollectNodeTree(node, unmountOnly) {
        // @TODO: Need to make a call on whether Preact should remove nodes not created by itself.
        // 目前行为是删除它. Discussion: https://github.com/developit/preact/issues/39

        var attrs = node[ATTR_KEY];
        if (attrs) {
            hook(attrs, 'ref', null);
        }

        var component = node._component;
        if (component) { //遇到组件节点则调用unmountComponent。（remove = 组件回收周期?false:true） => !unmountOnly
            unmountComponent(node, component, !unmountOnly);
        } else {
            if (!unmountOnly) { //非组件回收周期需要回收节点
                if (getNodeType(node) !== 1) {
                    var p = node.parentNode;
                    if (p) {
                        p.removeChild(node);
                    }
                    return;
                }
                collectNode(node);
            }

            var c = node.childNodes;
            if (c && c.length) {
                removeOrphanedChildren(c, unmountOnly);
            }
        }
    }

    function diffAttributes(dom, vnode) {
        var old = getNodeAttributes(dom) || EMPTY,
            attrs = vnode.attributes || EMPTY,
            name,
            value;

        // 移除
        for (name in old) {
            if (empty(attrs[name])) {
                setAccessor(dom, name, null);
            }
        }

        // 新增 或 更新
        if (attrs !== EMPTY) {
            for (name in attrs) {
                if (hasOwnProperty.call(attrs, name)) {
                    value = attrs[name];
                    if (!empty(value) && value != getAccessor(dom, name)) {
                        setAccessor(dom, name, value);
                    }
                }
            }
        }
    }

    var components = {};

    function collectComponent(component) {
        var name = component.constructor.name,
            list = components[name];
        if (list) {
            list.push(component);
        } else {
            components[name] = [component];
        }
    }

    function createComponent(ctor, props, context) {
        var list = components[ctor.name],
            len = list && list.length,
            c;
        for (var i = 0; i < len; i++) {
            c = list[i];
            if (c.constructor === ctor) {
                list.splice(i, 1);
                return c;
            }
        }
        return new ctor(props, context);
    }

    /** Set a component's `props` (generally derived from JSX attributes).
	*	@param {Object} props
	*	@param {Object} [opts]
	*	@param {boolean} [opts.renderSync=false]	If `true` and {@link options.syncComponentUpdates} is `true`, triggers synchronous rendering.
	*	@param {boolean} [opts.render=true]			If `false`, no render will be triggered.
	*/

    function setComponentProps(component, props, opts, context) {
        var d = component._disableRendering;

        component._ref = props.ref;
        delete props.ref;
        delete props.key;

        component._disableRendering = true;

        if (context) {
            if (!component.prevContext) {
                component.prevContext = component.context;
            }
            component.context = context;
        }

        if (component.base) {
            hook(component, 'componentWillReceiveProps', props, component.context);
        }

        if (!component.prevProps) {
            component.prevProps = component.props;
        }
        component.props = props;

        component._disableRendering = d;

        if (!opts || opts.render !== false) {
            if ((opts && opts.renderSync) || options.syncComponentUpdates !== false) {
                renderComponent(component);
            } else {
                triggerComponentRender(component);
            }
        }

        hook(component, '_ref', component);
    }

    function renderComponent(component) {
        if (component._disableRendering) {
            return void(0);
        }

        var rendered,
            skip = false,
            props = component.props,
            state = component.state,
            context = component.context,
            previousProps = component.prevProps || props,
            previousState = component.prevState || state,
            previousContext = component.prevContext || context,
            isUpdate = inDocument(component.base);

        if (isUpdate) {
            component.props = previousProps;
            component.state = previousState;
            component.context = previousContext;
            if (hook(component, 'shouldComponentUpdate', props, state, context) === false) {
                skip = true;
            } else {
                hook(component, 'componentWillUpdate', props, state, context);
            }
            component.props = props;
            component.state = state;
            component.context = context;
        } else {
            hook(component, 'componentWillMount');
        }

        component.prevProps = component.prevState = component.prevContext = null;
        component._dirty = false;

        if (!skip) {
            rendered = hook(component, 'render', props, state, context);

            var childComponent = rendered && rendered.nodeName,
                childContext = component.getChildContext ? component.getChildContext() : context, // @TODO might want to clone() new context obj
                toUnmount,
                base;

            if (isFunction(childComponent) && childComponent.prototype.render) {
                // 建立高阶组件链接

                var inst = component._component;
                toUnmount = inst;
                if (toUnmount && toUnmount.constructor !== childComponent) {
                    unmountComponent(toUnmount.base, toUnmount, true);
                    inst = null;
                }

                var childProps = getNodeProps(rendered);

                if (inst) {
                    setComponentProps(inst, childProps, SYNC_RENDER, childContext);
                } else {
                    inst = createComponent(childComponent, childProps, childContext);
                    inst._parentComponent = component;
                    component._component = inst;

                    setComponentProps(inst, childProps, NO_RENDER, childContext);
                    renderComponent(inst);
                }

                base = inst.base;
            } else {
                var cbase = component.base;

                // 销毁高阶组件链接
                toUnmount = component._component;
                if (toUnmount) {
                    unmountComponent(toUnmount.base, toUnmount, true);
                    cbase = component._component = null;
                }

                base = diff(cbase, (rendered || EMPTY_BASE), childContext);
            }

            if (component.base && base !== component.base) {
                var p = component.base.parentNode;
                if (p) {
                    p.replaceChild(base, component.base);
                }
            }

            component.base = base;

            if (base) {
                var componentRef = component,
                    t = component;

                while (t = t._parentComponent) {
                    componentRef = t;
                }
                base._component = componentRef;
                base._componentConstructor = componentRef.constructor;
            }

            if (isUpdate) {
                hook(component, 'componentDidUpdate', previousProps, previousState, previousContext);
            } else {
                hook(component, 'componentDidMount');
                component._isMounted = true;
            }
        }

        var cb = component._renderCallbacks,
            fn;

        if (cb) {
            while (fn = cb.pop()) {
                fn.call(component);
            }
        }
        return rendered;
    }

    var items = [],
        itemsOffline = [];

    function rerender() {
        if (!items.length) {
            return;
        }

        var currentItems = items,
            p;

        // 交互 online 和 offline
        items = itemsOffline;
        itemsOffline = currentItems;
        while (p = itemsOffline.pop()) {
            if (p._dirty) {
                renderComponent(p);
            }
        }
    }

    function enqueueRender(component) {
        if (items.push(component) !== 1) {
            return;
        }
        (options.debounceRendering || setImmediate)(rerender);
    }

    /**标记component为dirty,加入队列等待渲染.*/

    function triggerComponentRender(component) {
        if (!component._dirty) {
            component._dirty = true;
            enqueueRender(component);
        }
    }

    function buildComponentFromVNode(dom, vnode, context) {
        var c = dom && dom._component,
            isOwner = c && (dom._componentConstructor === vnode.nodeName),
            oldDom = dom;

        while (c && !isOwner && (c = c._parentComponent)) {
            isOwner = (c.constructor === vnode.nodeName);
        }

        if (isOwner) {
            setComponentProps(c, getNodeProps(vnode), SYNC_RENDER, context);
            dom = c.base;
        } else {
            if (c) {
                unmountComponent(dom, c, true);
                oldDom = null;
            }
            dom = createComponentFromVNode(oldDom, vnode, context);
            if (oldDom && dom !== oldDom) {
                recollectNodeTree(oldDom);
            }
        }
        return dom;
    }

    /** 实例化和渲染一个Component, VNode的nodeName是一个构造函数【继承自Component】.*/

    function createComponentFromVNode(dom, vnode, context) {
        var props = getNodeProps(vnode);
        var component = createComponent(vnode.nodeName, props, context);

        if (dom && !component.base) {
            component.base = dom;
        }

        setComponentProps(component, props, NO_RENDER, context);
        renderComponent(component);

        return component.base;
    }

    /** 从DOM中移除一个component并且回收它.当为顶级组件时remove为true*/

    function unmountComponent(dom, component, remove) {
        hook(component, '_ref', null);
        hook(component, 'componentWillUnmount');

        var inner = component._component;
        if (inner) {
            unmountComponent(dom, inner);
        }

        var base = component.base;

        if (base) {
            if (remove) {
                var p = base.parentNode;
                if (p) {
                    p.removeChild(base);
                }
            }
            removeOrphanedChildren(base.childNodes, true);
        }

        if (remove) {
            component._parentComponent = null;
            collectComponent(component);
        }

        hook(component, 'componentDidUnmount');
        component._isMounted = true;
    }

    function Component(props, context) {
        this._dirty = this._disableRendering = this._isMounted = false;
        this._linkedStates = {};
        this._renderCallbacks = [];
        this._parentComponent = this._component = this._ref = null;
        this.prevState = this.prevProps = this.prevContext = this.base = null;
        this.context = context || {};
        this.props = props || {};
        this.state = hook(this, 'getInitialState') || {};
    }

    extend(Component.prototype, {
        shouldComponentUpdate: function(props, state, context) {
            return true;
        },
        linkState: function(key, eventPath) {
            var c = this._linkedStates,
                cacheKey = key + '|' + (eventPath || '');

            return c[cacheKey] || (c[cacheKey] = createLinkedState(this, key, eventPath));
        },
        setState: function(state, callback) {
            var s = this.state;
            if (!this.prevState) {
                this.prevState = clone(s);
            }

            extend(s, isFunction(state) ? state(s, this.props) : state);

            if (callback) {
                this._renderCallbacks.push(callback);
            }

            triggerComponentRender(this);
        },
        setProps: function() {
        },
        replaceState: function() {
        },
        replaceProps: function() {
        },
        isMounted: function() {
            return this._isMounted;
        },
        getDOMNode: function() {
            return this.base;
        },
        forceUpdate: function(callback) {
            if (callback) {
                this._renderCallbacks.push(callback);
            }
            renderComponent(this);
        },
        render: function(props, state) {
            return null;
        }
    });

    function render(vnode, parent, merge) {
        var built = diff(merge, vnode);

        if (built.parentNode !== parent) {
            parent.appendChild(built);
        }

        return built;
    }

    var preact = {
        h: h,
        Component: Component,
        render: render,
        rerender: rerender,
        options: options,
        hooks: options
    };

    /*以下内容是扩展的，为了不使用jsx*/

    preact.createClass = function(obj) {

        function F() {
            Component.call(this);
        }

        F.prototype = Object.create(Component.prototype);

        for (var i in obj) {
            if (i === 'getDefaultProps') {
                F.defaultProps = obj['getDefaultProps']() || {};
            } else {
                F.prototype[i] = obj[i];
            }
        }

        F.prototype.constructor = F;

        return F;
    };

    return preact;
});

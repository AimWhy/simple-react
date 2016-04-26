window.preact = (function (global) {
    'use strict';

    var isFunction = function (obj) {
        return 'function' === typeof obj;
    };

    var isString = function (obj) {
        return 'string' === typeof obj;
    };

    var isSimple = function (obj) {
        var type = typeof obj;
        return ('function' !== type && 'object' !== type);
    };

    var hasOwnProperty = function (obj, k) {
        return Object.prototype.hasOwnProperty.call(obj, k);
    };

    var extend = function (obj, props) {
        for (var k in props) {
            if (hasOwnProperty(props, k)) {
                obj[k] = props[k];
            }
        }
        return obj;
    };

    var clone = function (obj) {
        var out = {};
        for (var k in obj) {
            out[k] = obj[k];
        }
        return out;
    };

    var memoize = function (fn, mem) {
        mem = mem || {};
        return function (p) {
            return mem[p] ? mem[p] : mem[p] = fn(p);
        };
    };

    var toLowerCase = memoize(function (name) {
        return name.toLowerCase();
    });

    var toUpperCase = memoize(function (name) {
        return name.toUpperCase();
    });

    var delve = function (obj, key) {
        var keys = key.split('.');
        for (var i = 0, len = keys.length; i < len && obj; i++) {
            obj = obj[keys[i]];
        }
        return obj;
    };

    var hook = function (obj, name, a, b, c) {
        return obj[name] ? obj[name](a, b, c) : null;
    };

    var empty = function (x) {
        return x == null;
    };

    var falsey = function (x) {
        return x === false || x == null;
    };

    /** ******************************************  dom  ******************************************* */

    var EMPTY = {};

    var EMPTY_BASE = '';

    var TEXT_CONTENT = 'textContent' in document ? 'textContent' : 'nodeValue';

    var ATTR_KEY = typeof global.Symbol !== 'undefined' ? global.Symbol.for('reactattr') : '__reactattr_';

    var NON_DIMENSION_PROPS = {};
    [
        'boxFlex', 'boxFlexGroup', 'columnCount', 'fillOpacity', 'flex', 'flexGrow', 'flexPositive', 'flexShrink', 'flexNegative', 'fontWeight',
        'lineClamp', 'lineHeight', 'opacity', 'order', 'orphans', 'strokeOpacity', 'widows', 'zIndex', 'zoom'
    ].forEach(function (val) {
        NON_DIMENSION_PROPS[val] = true;
    });

    var options = {};

    var optionsHook = function (name, a, b) {
        return hook(options, name, a, b);
    };

    var setImmediate = (function () {
        var tickImmediate = global.setImmediate,
            tickObserver = global.MutationObserver;
        if (tickImmediate) {
            return tickImmediate.bind(global);
        } else if (tickObserver) {
            var node = document.createTextNode('react'),
                queue = [],
                bool = false,
                f = null,
                callback = function () {
                    f = queue.shift();
                    while (f) {
                        f();
                        f = queue.shift();
                    }
                };

            new tickObserver(callback).observe(node, {
                characterData: true
            });

            return function (fn) {
                queue.push(fn);
                bool = !bool;
                node.data = bool;
            };
        } else {
            return function (fn) {
                global.setTimeout(fn, 4);
            };
        }
    })();

    var removeNode = function (node) {
        var p = node.parentNode;
        if (p) {
            p.removeChild(node);
        }
    };

    var getNodeType = function (node) {
        return node.nodeType;
    };

    var ensureNodeData = function (node) {
        return node[ATTR_KEY] || (node[ATTR_KEY] = {});
    };

    /** fontSize -> font-size.*/

    var jsToCss = memoize(function (s) {
        return s.replace(/([A-Z])/g, '-$1').toLowerCase();
    });

    /** {zIndex:100, fontSize:14} -> 'z-index:100; font-size:14px;'.*/

    var styleObjToCss = function (style) {
        var str = '';
        for (var p in style) {
            var val = style[p];
            if (!empty(val)) {
                str += (jsToCss(p) + ':' + val + (typeof val === 'number' && !NON_DIMENSION_PROPS[p] ? 'px;' : ';'));
            }
        }
        return str;
    };

    /** {class1:true, class2:false, class3:1} -> 'class1 class3'.*/

    var hashToClassName = function (cls) {
        var str = '';
        for (var c in cls) {
            if (cls[c]) {
                str += (str ? (' ' + c) : c);
            }
        }
        return str;
    };

    /** 把style和class属性对应的object转成字符串, 使用上面两个方法.*/

    var normalize = function (obj, prop, fn) {
        var v = obj[prop];
        if (v && !isString(v)) {
            obj[prop] = fn(v);
        }
    };

    var getAccessor = function (node, name) {
        if (name === 'class') {
            return node.className;
        } else if (name === 'style') {
            return node.style.cssText;
        } else if (name !== 'type' && name in node) {
            return node[name];
        } else {
            return ensureNodeData(node)[name];
        }
    };

    var normalizeEventName = memoize(function (t) {
        return t.replace(/^on/i, '').toLowerCase();
    });

    var eventProxy = function (event) {
        var fn = this._listeners[normalizeEventName(event.type)];
        return fn ? fn.call(this, optionsHook('event', event) || event) : null;
    };

    var setComplexAccessor = function (node, name, value) {
        if (name.substring(0, 2) === 'on') {
            var _type = normalizeEventName(name),
                l = node._listeners || (node._listeners = {}),
                act = value ? 'add' : 'remove';

            node[act + 'EventListener'](_type, eventProxy);
            l[_type] = value;
        } else {
            if (falsey(value)) {
                node.removeAttribute(name);
            } else if (isSimple(value)) {
                node.setAttribute(name, value);
            }
        }
    };

    var setAccessor = function (node, name, value) {
        if (name === 'class') {
            node.className = value || '';
        } else if (name === 'style') {
            node.style.cssText = value || '';
        } else if (name === 'dangerouslySetInnerHTML') {
            if (value && value.__html) {
                node.innerHTML = value.__html;
            }
        } else if (name === 'key' || (name !== 'type' && name in node)) {
            node[name] = value;
            if (falsey(value)) {
                node.removeAttribute(name);
            }
        } else {
            setComplexAccessor(node, name, value);
        }
        ensureNodeData(node)[name] = value;
    };

    var getAttributesAsObject = function (list) {
        var attrs = {},
            len = list.length;
        while (len--) {
            var item = list[len];
            attrs[item.name] = item.value;
        }
        return attrs;
    };

    var getRawNodeAttributes = function (node) {
        var list = node.attributes;
        return (list && list.getNamedItem) ? getAttributesAsObject(list) : list;
    };

    var getNodeAttributes = function (node) {
        return node[ATTR_KEY] || (node[ATTR_KEY] = getRawNodeAttributes(node));
    };

    /** ******************************************  vnode  ******************************************* */

    var SYNC_RENDER = {
        renderSync: true
    };

    extend(options, {
        syncComponentUpdates: false,
        vnode: function (n) {
            var attrs = n.attributes;
            if (isString(n.nodeName)) {
                if (attrs) {
                    var cls = attrs.className;

                    if (cls) {
                        attrs['class'] = cls;
                        delete attrs.className;
                    }
                    if (attrs['class']) {
                        normalize(attrs, 'class', hashToClassName);
                    }
                    if (attrs.style) {
                        normalize(attrs, 'style', styleObjToCss);
                    }
                }
            } else { /** isComponent || isFunctionalComponent.*/
                var defaultProps = n.nodeName.defaultProps;

                n.attributes = attrs || {};
                if (n.children) {
                    n.attributes.children = n.children;
                }

                if (defaultProps) {
                    for (var i in defaultProps) {
                        if (!hasOwnProperty(n.attributes, i)) {
                            n.attributes[i] = defaultProps[i];
                        }
                    }
                }
            }
        }
    });

    function VNode(nodeName, attributes, children) {
        this.nodeName = nodeName;
        this.attributes = attributes;
        this.children = children;
    }

    var SHARED_TEMP_ARRAY = new Array(1);

    function h(nodeName, attributes) {
        var len = arguments.length,
            lastSimple = false,
            children = null,
            arr;

        if (attributes) {
            delete attributes.children;
        } else {
            attributes = null;
        }

        for (var i = 2; i < len; i++) {
            var arg = arguments[i];
            if (!falsey(arg)) {
                if (arg.join) {
                    arr = arg;
                } else {
                    SHARED_TEMP_ARRAY[0] = arg;
                    arr = SHARED_TEMP_ARRAY;
                }

                for (var j = 0, arrlen = arr.length; j < arrlen; j++) {
                    var child = arr[j];
                    if (!falsey(child)) {
                        var simple = isSimple(child);
                        if (simple) {
                            child = String(child);
                        }
                        if (children === null) {
                            children = [];
                        }
                        if (simple && lastSimple) {
                            children[children.length - 1] = children[children.length - 1] + child;
                        } else {
                            children.push(child);
                        }
                        lastSimple = simple;
                    }
                }
            }
        }

        var p = new VNode(nodeName, attributes, children);
        optionsHook('vnode', p);
        return p;
    }

    function isComponent(vnode) {
        var nodeName = vnode.nodeName;
        return isFunction(nodeName) && isFunction(nodeName.prototype.render);
    }

    function diffAttributes(dom, vnode) {
        var old = getNodeAttributes(dom) || EMPTY,
            attrs = vnode.attributes || EMPTY,
            name,
            value;

        for (name in old) { /** 移除.*/
            if (!hasOwnProperty(attrs, name)) {
                setAccessor(dom, name, null);
            }
        }

        if (attrs !== EMPTY) {
            for (name in attrs) { /** 新增 或 更新.*/
                value = attrs[name];
                if (!empty(value) && value !== getAccessor(dom, name)) {
                    setAccessor(dom, name, value);
                }
            }
        }
    }

    function getRealVnode(vnode, context) {
        context = context || {};
        while (isFunction(vnode.nodeName) && !vnode.nodeName.prototype.render) {
            vnode = vnode.nodeName(vnode.attributes, context) || EMPTY_BASE;
        }
        return vnode;
    }

    var nodes_cache = {};

    function cleanNode(node) {
        node._component = node._componentConstructor = node._ancestor = node._ancestorConstructor = null;
    }

    function collectNode(node) {
        var attrs = node[ATTR_KEY],
            name = toUpperCase(node.nodeName),
            list = nodes_cache[name] || (nodes_cache[name] = []);

        attrs && hook(attrs, 'ref', null);
        removeNode(node);
        cleanNode(node);
        list.push(node);
    }

    function createNode(nodeName) {
        var name = toUpperCase(nodeName),
            list = nodes_cache[name] || (nodes_cache[name] = []),
            node = list.length ? list.pop() : document.createElement(nodeName);

        ensureNodeData(node);
        return node;
    }

    var components_cache = {};

    function collectComponent(component) {
        var name = component.constructor.name,
            list = components_cache[name] || (components_cache[name] = []);

        component.clean();
        list.push(component);
    }

    function createComponent(ctor, props, context) {
        var list = components_cache[ctor.name] || (components_cache[ctor.name] = []);
        if (list.length) {
            var c = list.pop();

            c.props = props;
            c.context = context || {};
            var state = hook(c, 'getInitialState');
            c.state = state || {};
            return c;
        } else {
            return new ctor(props, context);
        }
    }

    function unmountComponent(component, isCollectNode) {
        hook(component, 'componentWillUnmount');
        hook(component, 'ref', null);

        var inner = component._component;

        if (inner) {
            unmountComponent(inner, isCollectNode);
        } else {
            var base = component.base;
            if (base) {
                if (isCollectNode) {
                    collectNode(base);
                    removeOrphanedChildren(base.childNodes);
                } else {
                    cleanNode(base);
                }
            }
        }

        collectComponent(component);
        component._isMounted = true;

        hook(component, 'componentDidUnmount');
    }

    function removeOrphanedChildren(children) {
        var len = children.length;
        while (len--) {
            var child = children[len];
            if (child) {
                recollectNodeTree(child);
            }
        }
    }

    function recollectNodeTree(node) {
        var ancestor = node._ancestor,
            nextSibling = node.nextSibling;
        if (ancestor) {
            unmountComponent(ancestor, true);
        } else {
            if (getNodeType(node) === 1) {
                collectNode(node);
                removeOrphanedChildren(node.childNodes);
            } else {
                removeNode(node);
            }
        }
        return nextSibling;
    }

    function isSameNodeType(node, vnode) {
        if (isString(vnode)) {
            return 3 === getNodeType(node);
        } else if (isString(vnode.nodeName)) {
            return vnode.nodeName === toLowerCase(node.nodeName);
        } else {
            return true;
        }
    }

    function createNodeToVNode(vchild) {
        if (isSimple(vchild)) {
            return document.createTextNode(String(vchild));
        } else if (isString(vchild.nodeName)) {
            return createNode(vchild.nodeName);
        } else if (isComponent(vchild)) {
            return createNode(vchild.nodeName.maybeTag);
        } else {
            throw 'vchild 为不可控值';
        }
    }

    function createLinkedState(component, key, eventPath) {
        var path = key.split('.'),
            len = path.length,
            p0 = path[0];

        return function (event) {
            var _component$setState = {},
                state = component.state,
                stateRef = state,
                node = this,
                value,
                c;

            if (isString(eventPath)) {
                value = delve(event, eventPath);
                if (empty(value) && (c = node._component)) {
                    value = delve(c, eventPath);
                }
            } else {
                value = (node.nodeName + node.type).match(/^input(check|rad)/i) ? node.checked : node.value;
            }
            if (isFunction(value)) {
                value = value.call(node);
            }

            if (len > 1) {
                var i = 0;
                for (; i < len - 1; i++) {
                    stateRef = stateRef[path[i]] || (stateRef[path[i]] = {});
                }
                stateRef[path[i]] = value;
                value = state[p0];
            }

            _component$setState[p0] = value;
            component.setState(_component$setState);
        };
    }

    function updateComponentBaseUp(component, base) {
        var tagName = toLowerCase(base.nodeName);

        while (component) {
            component.base = base;
            component.constructor.maybeTag = tagName;
            component = component._parentComponent;
        }
    }

    function buildAndRenderComponent(dom, vnode, context) {
        var component = createComponent(vnode.nodeName, vnode.attributes, context);
        component.base = dom;
        return component;
    }

    function updateComponent(component, props, opts, context) {
        component.key = props.key;
        component.ref = props.ref;
        delete props.key;
        delete props.ref;

        if (context) {
            if (!component.prevContext) {
                component.prevContext = component.context;
            }
            component.context = context;
        }

        var d = component._disableRendering;
        component._disableRendering = false;
        hook(component, 'componentWillReceiveProps', props, component.context);
        component._disableRendering = d;

        if (!component.prevProps) {
            component.prevProps = component.props;
        }
        component.props = props;

        if ((opts && opts.renderSync) || options.syncComponentUpdates) {
            renderComponent(component);
        } else {
            triggerComponentRender(component);
        }

        hook(component, 'ref', component);
    }

    function renderComponent(component) {
        if (component._disableRendering) {
            return;
        }

        var skip = false,
            props = component.props,
            state = component.state,
            context = component.context,
            previousProps = component.prevProps,
            previousState = component.prevState,
            previousContext = component.prevContext,
            isUpdate = component._isMounted;

        if (isUpdate) {
            component.props = previousProps;
            component.state = previousState;
            component.context = previousContext;

            skip = hook(component, 'shouldComponentUpdate', props, state, context) === false;

            if (!skip) {
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
            var vnode = hook(component, 'render', props, state, context),
                inst = component._component,
                cbase = component.base;

            vnode = getRealVnode(vnode, context);

            if (isComponent(vnode)) {
                var childComponent = vnode && vnode.nodeName,
                    childContext = component.getChildContext ? component.getChildContext() : context;

                if (inst && inst.constructor === childComponent) {
                    updateComponent(inst, vnode.attributes, SYNC_RENDER, childContext);
                } else {
                    inst && unmountComponent(inst);
                    inst = buildAndRenderComponent(cbase, vnode, childContext);
                    component._component = inst;
                    inst._parentComponent = component;

                    renderComponent(inst);
                }
            } else {
                inst && unmountComponent(inst);

                if (!isSameNodeType(cbase, vnode)) {
                    var next = cbase.nextSibling,
                        parent = cbase.parentNode,
                        realBase = createNodeToVNode(vnode);

                    realBase._ancestor = cbase._ancestor;
                    realBase._ancestorConstructor = cbase._ancestorConstructor;

                    collectNode(cbase);
                    removeOrphanedChildren(cbase.childNodes);

                    cbase = parent.insertBefore(realBase, next);
                    updateComponentBaseUp(component, cbase);
                }

                cbase._componentConstructor = component.constructor;
                cbase._component = component;

                diff(cbase, vnode);
            }

            if (isUpdate) {
                hook(component, 'componentDidUpdate', previousProps, previousState, previousContext);
            } else {
                hook(component, 'componentDidMount');
                component._isMounted = true;
            }
        }

        var cb = component._renderCallbacks;

        if (cb) {
            var fn = cb.pop();
            while (fn) {
                fn.call(component);
                fn = cb.pop();
            }
        }
    }

    var items = [],
        itemsOffline = [];

    function rerender() {
        if (items.length) {
            var currentItems = items, p;

            items = itemsOffline; /** 交换 online 和 offline.*/
            itemsOffline = currentItems;
            p = itemsOffline.pop();
            while (p) {
                if (p._dirty) {
                    renderComponent(p);
                }
                p = itemsOffline.pop();
            }
        }
    }

    function enqueueRender(component) {
        if (items.push(component) === 1) {
            (options.debounceRendering || setImmediate)(rerender);
        }
    }

    function triggerComponentRender(component) {
        if (!component._dirty) {
            component._dirty = true;
            enqueueRender(component);
        }
    }

    function innerDiffNode(dom, vnode) {
        var vchildren = vnode.children,
            vlen = vchildren.length,
            len = dom.childNodes.length,
            cacheMap = {},
            keyedMap = {},
            key,
            i;

        for (var idx = 0; idx < len; idx++) {
            var child = dom.childNodes[idx],
                component = child._component;

            key = getAccessor(child, 'key') || (component && component.key);
            if (!empty(key)) {
                keyedMap[key] = child;
            } else {
                if (component) {
                    if (cacheMap[child._ancestorConstructor.name]) {
                        cacheMap[child._ancestorConstructor.name].push(child);
                    } else {
                        cacheMap[child._ancestorConstructor.name] = [child];
                    }
                } else {
                    var tagname = toLowerCase(child.nodeName);
                    if (cacheMap[tagname]) {
                        cacheMap[tagname].push(child);
                    } else {
                        cacheMap[tagname] = [child];
                    }
                }
            }
        }

        for (i = 0; i < vlen; i++) {
            var vchild = getRealVnode(vchildren[i]),
                attrs = vchild.attributes,
                child2 = null;

            key = attrs && attrs.key;

            if (!empty(key) && hasOwnProperty(keyedMap, key)) {
                child2 = keyedMap[key];
                delete keyedMap[key];
            } else if (isComponent(vchild)) {
                if (cacheMap[vchild.nodeName.name] && cacheMap[vchild.nodeName.name].length) {
                    child2 = cacheMap[vchild.nodeName.name].shift();
                }
            } else if (isString(vchild.nodeName)) {
                if (cacheMap[vchild.nodeName] && cacheMap[vchild.nodeName].length) {
                    child2 = cacheMap[vchild.nodeName].shift();
                }
            } else {
                if (isString(vchild) && cacheMap['#text'] && cacheMap['#text'].length) {
                    child2 = cacheMap['#text'].shift();
                }
            }

            if (child2 === null) {
                child2 = createNodeToVNode(vchild);
            }

            if (child2 !== dom.childNodes[i]) {
                dom.insertBefore(child2, dom.childNodes[i] || null);
            }

            _render(child2, vchild);
        }

        var toCollectNode = dom.childNodes[i];

        while (toCollectNode) {
            toCollectNode = recollectNodeTree(toCollectNode);
        }
    }

    function diff(dom, vnode) { /** 注：此时dom与vnode必为相同类型.*/
        var originalAttributes = vnode.attributes;

        if (3 === getNodeType(dom)) {
            dom[TEXT_CONTENT] = vnode;
        } else {
            if (vnode.children && vnode.children.length) {
                innerDiffNode(dom, vnode);
            } else {
                dom.childNodes.length && removeOrphanedChildren(dom.childNodes);
            }

            diffAttributes(dom, vnode);

            if (originalAttributes && originalAttributes.ref) {
                dom[ATTR_KEY].ref = originalAttributes.ref;
                dom[ATTR_KEY].ref(dom);
            }
        }
    }

    function _render(merge, vnode, context) {
        if (merge._ancestor) { //渲染组件
            updateComponent(merge._ancestor, vnode.attributes, SYNC_RENDER, context);
        } else {
            if (isComponent(vnode)) { //新建组件
                var ancestor = buildAndRenderComponent(merge, vnode);

                merge._ancestor = ancestor;
                merge._ancestorConstructor = ancestor.constructor;
                renderComponent(ancestor);
            } else { //渲染节点
                diff(merge, vnode);
            }
        }
    }

    function Component(props, context) {
        this._dirty = this._disableRendering = this._isMounted = false;
        this._parentComponent = this._component = this.ref = this.key = this._linkedStates = null;
        this.prevState = this.prevProps = this.prevContext = this.base = null;
        this._renderCallbacks = [];
        this.context = context || {};
        this.props = props;
        this.state = hook(this, 'getInitialState') || {};
        return this;
    }

    Component.prototype.shouldComponentUpdate = function (props, state, context) {
        return true;
    };
    Component.prototype.linkState = function (key, eventPath) {
        var c = this._linkedStates || (this._linkedStates = {}), cacheKey = key + '|' + (eventPath || '');

        return c[cacheKey] || (c[cacheKey] = createLinkedState(this, key, eventPath));
    };
    Component.prototype.setState = function (state, callback, isReplace) {
        if (typeof callback === 'boolean') {
            isReplace = callback;
            callback = null;
        }
        if (!this.prevState) {
            this.prevState = clone(this.state);
        }
        if (callback) {
            this._renderCallbacks.push(callback);
        }

        state = isFunction(state) ? state(this.state, this.props) : state;

        if (isReplace) {
            this.state = state;
        } else {
            extend(this.state, state);
        }

        triggerComponentRender(this);
    };
    Component.prototype.setProps = function (props, callback, isReplace) {
        if (typeof callback === 'boolean') {
            isReplace = callback;
            callback = null;
        }
        if (callback) {
            this._renderCallbacks.push(callback);
        }

        props = isFunction(props) ? props(this.state, this.props) : props;

        if (!isReplace) {
            for (var i in this.props) {
                if (!hasOwnProperty(props, i)) {
                    props = this.props[i];
                }
            }
        }

        updateComponent(this, props);
    };
    Component.prototype.isMounted = function () {
        return this._isMounted;
    };
    Component.prototype.getDOMNode = function () {
        return this.base;
    };
    Component.prototype.forceUpdate = function (callback) {
        if (callback) {
            this._renderCallbacks.push(callback);
        }
        renderComponent(this);
    };
    Component.prototype.render = function (props, state) {
        return JSON.stringify(state);
    };
    Component.prototype.clean = function () {
        this._dirty = this._disableRendering = this._isMounted = false;
        this._parentComponent = this._component = this.ref = this.key = this._linkedStates = null;
        this.prevState = this.prevProps = this.prevContext = this.base = null;
        this._renderCallbacks.length = 0;
    };

    function createClass(obj) {
        var F_Name = String(Math.random() + Math.random()).replace(/\d\.\d{4}/, 'Component'),
            F = Function('Component', 'return function ' + F_Name + '() { return Component.apply(this, arguments);};')(Component); /** 使用Object.defineProperty定义name也是可以的.*/

        F.maybeTag = 'div';
        F.prototype = Object.create(Component.prototype);

        if (obj.getDefaultProps) {
            F.defaultProps = obj.getDefaultProps();
            delete obj.getDefaultProps;
        }

        for (var i in obj) {
            if (obj.hasOwnProperty(i)) {
                F.prototype[i] = obj[i];
            }
        }

        return F.prototype.constructor = F;
    }

    return {
        h: h,
        hooks: options,
        render: function (merge, vnode, context) {
            vnode = getRealVnode(vnode, context);

            if (merge._ancestorConstructor) {
                if (merge._ancestorConstructor !== vnode.nodeName) { /** 注：vnode 不为组件 或 不同组件时.*/
                    unmountComponent(merge._ancestor);
                    cleanNode(merge);
                }
            }

            if (!isSameNodeType(merge, vnode)) { /** 注：vnode 不为组件 且 两节点类型不同时.*/
                var next = merge.nextSibling,
                    parent = merge.parentNode,
                    realMerge = createNodeToVNode(vnode);

                recollectNodeTree(merge);
                merge = parent.insertBefore(realMerge, next);
            }

            _render(merge, vnode, context);
        },
        rerender: rerender,
        Component: Component,
        createClass: createClass
    };
})(window);

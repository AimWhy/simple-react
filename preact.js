window.preact = (function(global) {
    'use strict';

    var isFunction = function(obj) {
        return 'function' === typeof obj;
    };

    var isString = function(obj) {
        return 'string' === typeof obj;
    };

    var isSimple = function(obj) {
        var type = typeof obj;
        return ('function' !== type && 'object' !== type);
    };

    var hasOwnProperty = function() {
        var _hasOwnProperty = Object.prototype.hasOwnProperty;
        return function(obj, prop) {
            return _hasOwnProperty.call(obj, prop);
        };
    }();

    var extend = function(obj, props) {
        for (var i in props) {
            if (hasOwnProperty(props, i)) {
                obj[i] = props[i];
            }
        }
        return obj;
    };

    var clone = function(obj) {
        var out = {};
        for (var i in obj) {
            out[i] = obj[i];
        }
        return out;
    };

    var memoize = function(fn, mem) {
        mem = mem || {};
        return function(k) {
            return mem[k] ? mem[k] : mem[k] = fn(k);
        };
    };

    var toLowerCase = memoize(function(name) {
        return name.toLowerCase();
    });

    var toUpperCase = memoize(function(name) {
        return name.toUpperCase();
    });

    /** 从给定对象(obj)中获取深层属性值,用点号表述.*/

    var delve = function(obj, key) {
        var keys = key.split('.');
        for (var i = 0, len = keys.length; i < len && obj; i++) {
            obj = obj[keys[i]];
        }
        return obj;
    };

    var toArray = function(obj) {
        var len = obj.length,
            arr = new Array(len);
        while (len--) {
            arr[len] = obj[len];
        }
        return arr;
    };

    var hook = function(obj, name, a, b, c) {
        return obj[name] ? obj[name](a, b, c) : void(0);
    };

    var empty = function(x) {
        return x == null;
    };

    var falsey = function(x) {
        return x === false || x == null;
    };

    /******************************************/

    var EMPTY = {};
    var EMPTY_BASE = '';
    var TEXT_CONTENT = 'textContent' in document ? 'textContent' : 'nodeValue';
    var ATTR_KEY = typeof global.Symbol !== 'undefined' ? global.Symbol.for('preactattr') : '__preactattr_';

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

    var options = {};
    var optionsHook = function(name, a, b) {
        return hook(options, name, a, b);
    };

    var setImmediate = (function() {
        var tickImmediate = global.setImmediate,
            tickObserver = global.MutationObserver;
        if (tickImmediate) {
            return tickImmediate.bind(global);
        } else if (tickObserver) {
            var node = document.createTextNode('preact'),
                queue = [],
                bool = false,
                callback = function() {
                    var n = queue.length;
                    for (var i = 0; i < n; i++) {
                        queue[i]();
                    }
                    queue = queue.slice(n);
                };

            new tickObserver(callback).observe(node, { characterData: true });

            return function(fn) {
                queue.push(fn);
                bool = !bool;
                node.data = bool;
            };
        } else {
            return function(fn) {
                setTimeout(fn, 4);
            };
        }
    })();

    var removeNode = function(node) {
        var p = node.parentNode;
        if (p) {
            p.removeChild(node);
        }
    };

    var replaceNode = function(newNode, node) {
        var p = node.parentNode;
        if (p) {
            p.replaceChild(newNode, node);
        }
        return node;
    };

    var createNodeReplace = function(oldNode) {
        var newNode = document.createElement('div');
        var p = oldNode.parentNode;
        if (p) {
            p.replaceChild(newNode, oldNode);
        }
        return newNode;
    };

    var getNodeType = function(node) {
        return node.nodeType;
    };

    var ensureNodeData = function(node) {
        return node[ATTR_KEY] || (node[ATTR_KEY] = {});
    };

    var appendChildren = function(parent, children) {
        var len = children.length,
            many = len > 2,
            into = many ? document.createDocumentFragment() : parent;

        for (var i = 0; i < len; i++) {
            into.appendChild(children[i]);
        }
        if (many) {
            parent.appendChild(into);
        }
    };

    /** fontSize -> font-size.*/

    var jsToCss = memoize(function(s) {
        return toLowerCase(s.replace(/([A-Z])/g, '-$1'));
    });

    /** {zIndex:100, fontSize:14} -> 'z-index:100; font-size:14px;'.*/

    var styleObjToCss = function(s) {
        var str = '';
        for (var prop in s) {
            var val = s[prop];
            if (!empty(val)) {
                if (str) {
                    str += ' ';
                }
                str += (jsToCss(prop) + ':' + val);
                if (typeof val === 'number' && !NON_DIMENSION_PROPS[prop]) {
                    str += 'px;';
                } else {
                    str += ';';
                }
            }

        }
        return str;
    };

    /** {class1:true, class2:false, class3:1} -> 'class1 class3'.*/

    var hashToClassName = function(c) {
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
    };

    /** 把style和class属性对应的object转成字符串, 使用上面两个方法.*/

    var normalize = function(obj, prop, fn) {
        var v = obj[prop];
        if (v && !isString(v)) {
            obj[prop] = fn(v);
        }
    };

    var getAccessor = function(node, name) {
        if (name === 'class') {
            return node.className;
        } else if (name === 'style') {
            return node.style.cssText;
        } else if (name !== 'type' && name in node) {
            return node[name];
        } else {
            var attrs = node[ATTR_KEY];
            return (attrs && hasOwnProperty(attrs, name)) ? attrs[name] : void(0);
        }
    };

    var normalizeEventName = memoize(function(t) {
        return toLowerCase(t.replace(/^on/i, ''));
    });

    var eventProxy = function(event) {
        var fn = this._listeners[normalizeEventName(event.type)];

        return fn ? fn.call(this, optionsHook('event', event) || event) : void(0);
    };

    var setComplexAccessor = function(node, name, value) {
        if (name.substring(0, 2) === 'on') {
            var _type = normalizeEventName(name),
                l = node._listeners || (node._listeners = {}),
                fn = value ? 'add' : 'remove';

            node[fn + 'EventListener'](_type, eventProxy);
            l[_type] = value;
        } else {
            var type = typeof value;

            if (falsey(value)) {
                node.removeAttribute(name);
            } else if (isSimple(type)) {
                node.setAttribute(name, value);
            }
        }
    };

    var setAccessor = function(node, name, value) {
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

    var getAttributesAsObject = function(list) {
        var attrs = {},
            len = list.length;
        while (len--) {
            var item = list[len];
            attrs[item.name] = item.value;
        }
        return attrs;
    };

    var getRawNodeAttributes = function(node) {
        var list = node.attributes;
        return (list && list.getNamedItem) ? getAttributesAsObject(list) : list;
    };

    var getNodeAttributes = function(node) {
        return node[ATTR_KEY] ? node[ATTR_KEY] : (node[ATTR_KEY] = getRawNodeAttributes(node));
    };

    /******************************************/

    function VNode(nodeName, attributes, children) {
        this.nodeName = nodeName;
        this.attributes = attributes;
        this.children = children;
    }

    extend(options, {
        /** 如果`true`，`prop`变化将同步触发组件更新.*/
        syncComponentUpdates: false,

        /** 处理所有新创建VNode的className, style.*/
        vnode: function(n) {
            var attrs = n.attributes;
            if (!isFunction(n.nodeName) && attrs) {
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
        }
    });


    var NO_RENDER = {
        render: false
    };
    var SYNC_RENDER = {
        renderSync: true
    };

    var SHARED_TEMP_ARRAY = [];

    function h(nodeName, attributes) {
        var len = arguments.length,
            lastSimple = false,
            children = [],
            arr;

        if (attributes) {
            delete attributes.children;
        } else {
            attributes = void(0);
        }

        for (var i = 2; i < len; i++) {
            var _p = arguments[i];
            if (!falsey(_p)) {
                if (_p.join) {
                    arr = _p;
                } else {
                    arr = SHARED_TEMP_ARRAY;
                    arr[0] = _p;
                }

                for (var j = 0; j < arr.length; j++) {
                    var child = arr[j];
                    if (!falsey(child)) {
                        var simple = isSimple(child);
                        if (simple) {
                            child = String(child);
                        }
                        if (simple && lastSimple) {
                            children[children.length - 1] += child;
                        } else {
                            children.push(child);
                        }
                        lastSimple = simple;
                    }
                }
            }
        }

        var p = new VNode(nodeName, attributes, children.length ? children : void(0));
        optionsHook('vnode', p);
        return p;
    }

    function createLinkedState(component, key, eventPath) {
        var path = key.split('.'),
            len = path.length,
            p0 = path[0];

        return function(event) {
            var _component$setState = {},
                state = component.state,
                stateRef = state,
                node = this,
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

    function getNodeProps(vnode) {
        var props = clone(vnode.attributes),
            c = vnode.children;
        if (c) {
            props.children = c;
        }
        var defaultProps = vnode.nodeName.defaultProps;
        if (defaultProps) {
            for (var i in defaultProps) {
                if (!(i in props)) {
                    props[i] = defaultProps[i];
                }
            }
        }

        return props;
    }

    function isFunctionalComponent(vnode) {
        var nodeName = vnode.nodeName;
        return isFunction(nodeName) && !nodeName.prototype.render;
    }

    function isComponent(vnode) {
        var nodeName = vnode.nodeName;
        return isFunction(nodeName) && isFunction(nodeName.prototype.render);
    }

    function buildFunctionalComponent(vnode, context) {
        return vnode.nodeName(getNodeProps(vnode), context || EMPTY) || EMPTY_BASE;
    }

    function isSameNodeType(node, vnode) {
        var nodeName = vnode.nodeName;

        if (isFunctionalComponent(vnode)) {
            return true;
        } else if (isFunction(nodeName)) {
            return nodeName === node._componentConstructor;
        } else if (isString(nodeName)) {
            return nodeName === toLowerCase(node.nodeName);
        } else {
            return 3 === getNodeType(node);
        }
    }

    /** DOM节点缓存池,以nodeName.toUpperCase()为键*/

    var nodes_cache = {};

    function cleanNode(node) {
        removeNode(node);
        if (getNodeType(node) === 1) {
            getNodeAttributes(node);
            node._component = node._componentConstructor = null;
        }
    }

    function collectNode(node) {
        cleanNode(node);
        var name = toUpperCase(node.nodeName),
            list = nodes_cache[name];

        if (list) {
            list.push(node);
        } else {
            nodes_cache[name] = [node];
        }
    }

    function createNode(nodeName) {
        var name = toUpperCase(nodeName),
            list = nodes_cache[name],
            node = list && list.pop() || document.createElement(nodeName);

        ensureNodeData(node);
        return node;
    }

    /** 组件DOM节点缓存池*/

    var components_cache = {};

    function collectComponent(component) {
        var name = component.constructor.name,
            list = components_cache[name];
        component._destroy();
        if (list) {
            list.push(component);
        } else {
            components_cache[name] = [component];
        }
    }

    function createComponent(ctor, props, context) {
        var list = components_cache[ctor.name],
            len = list && list.length,
            component;
        for (var i = 0; i < len; i++) {
            component = list[i];
            if (component.constructor === ctor) {
                list.splice(i, 1);
                return component._reuse(props, context);
            }
        }
        return new ctor(props, context);
    }

    function removeOrphanedChildren(children) {
        for (var i = children.length; i--;) {
            var child = children[i];
            if (child) {
                recollectNodeTree(child);
            }
        }
    }

    function recollectNodeTree(node) {
        var attrs = node[ATTR_KEY];
        if (attrs) {
            hook(attrs, 'ref', null);
        }

        var component = node._component;
        if (component) {
            unmountComponent(component);
        } else {
            if (getNodeType(node) !== 1) {
                removeNode(node);
            } else {
                collectNode(node);

                var childs = node.childNodes;
                if (childs && childs.length) {
                    removeOrphanedChildren(childs);
                }
            }
        }
    }

    function fixComponentBase(parent, dom) {
        if (parent.base) {
            replaceChild(parent.base, dom);
            recollectNodeTree(dom);
        } else {
            parent.base = dom;
        }
    }

    function swapComponentBase(parent, son) {
        if (son.base) {
            replaceChild(son.base, parent.base);
            recollectNodeTree(parent.base);
        } else {
            son.base = parent.base;
        }
    }

    /** 通过vNode来更新节点node的属性. */

    function diffAttributes(dom, vnode) {
        var old = getNodeAttributes(dom) || EMPTY,
            attrs = vnode.attributes || EMPTY,
            name,
            value;

        // 移除
        for (name in old) {
            if (!hasOwnProperty(attrs, name) && !empty(old[name])) {
                setAccessor(dom, name, null);
            }
        }

        // 新增 或 更新
        if (attrs !== EMPTY) {
            for (name in attrs) {
                value = attrs[name];
                if (!empty(value) && value != getAccessor(dom, name)) {
                    setAccessor(dom, name, value);
                }
            }
        }
    }


    /** 移除自定义组件.*/

    function unmountComponent(component, isRecursive) {
        hook(component, '__ref', null);
        hook(component, 'componentWillUnmount');

        if (!isRecursive) {
            component._parentComponent = null;
            collectComponent(component);
        }
        var inner = component._component;
        if (inner) {
            component.base = null;
            unmountComponent(inner, true);
        } else {
            var base = component.base;
            removeNode(base);
            removeOrphanedChildren(base.childNodes);
        }

        hook(component, 'componentDidUnmount');
        component._isMounted = true;
    }

    /** 渲染自定义组件.*/

    function renderComponent(component) {
        if (component._disableRendering) {
            return;
        }

        var rendered,
            skip = false,
            props = component.props,
            state = component.state,
            context = component.context,
            previousProps = component.prevProps || props,
            previousState = component.prevState || state,
            previousContext = component.prevContext || context,
            isUpdate = component._isMounted;

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
                childContext = component.getChildContext ? component.getChildContext() : context,
                cbase = component.base,
                inst,
                base;

            if (isComponent(rendered)) {
                // 建立高阶组件链接

                inst = component._component;
                if (inst && inst.constructor !== childComponent) {
                    unmountComponent(inst);
                    inst = null;
                }

                var childProps = getNodeProps(rendered);

                if (inst) {
                    swapComponentBase(component, inst);
                    setComponentProps(inst, childProps, SYNC_RENDER, childContext);
                } else {
                    inst = createComponent(childComponent, childProps, childContext);
                    inst._parentComponent = component;
                    swapComponentBase(component, inst);
                    component._component = inst;
                    setComponentProps(inst, childProps, NO_RENDER, childContext);
                    renderComponent(inst);
                }

                base = inst.base;
            } else {
                // 销毁高阶组件链接
                inst = component._component;
                if (inst) {
                    cbase = createNodeReplace(cbase);
                    unmountComponent(inst);
                    component._component = null;
                }
                base = diff(cbase, (rendered || EMPTY_BASE), childContext);
                base._component = component;
                base._componentConstructor = component.constructor;
            }

            component.base = base;

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
    }

    var items = [],
        itemsOffline = [];

    function rerender() {
        if (items.length) {
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
    }

    function enqueueRender(component) {
        if (items.push(component) === 1) {
            (options.debounceRendering || setImmediate)(rerender);
        }
    }

    /**标记component为dirty,加入队列等待渲染.*/

    function triggerComponentRender(component) {
        if (!component._dirty) {
            component._dirty = true;
            enqueueRender(component);
        }
    }


    /** [opts.renderSync=false]	[opts.render=true].*/

    function setComponentProps(component, props, opts, context) {
        var d = component._disableRendering;

        component.__ref = props.ref;
        component.__key = props.key;

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
            if ((opts && opts.renderSync) || options.syncComponentUpdates) {
                renderComponent(component);
            } else {
                triggerComponentRender(component);
            }
        }

        hook(component, '__ref', component);
    }


    /** 实例化和渲染一个Component, VNode的nodeName是一个构造函数【继承自Component】.*/

    function createComponentFromVNode(dom, vnode, context) {
        var props = getNodeProps(vnode),
            component = createComponent(vnode.nodeName, props, context);

        fixComponentBase(component, dom);

        setComponentProps(component, props, NO_RENDER, context);
        renderComponent(component);

        return component.base;
    }

    /** 构建组件. */

    function buildComponentFromVNode(dom, vnode, context) {
        var c = dom && dom._component,
            isOwner = c && (dom._componentConstructor === vnode.nodeName),
            out;

        while (c && !isOwner && (c = c._parentComponent)) {
            isOwner = (c.constructor === vnode.nodeName);
        }

        if (isOwner) {
            setComponentProps(c, getNodeProps(vnode), SYNC_RENDER, context);
            out = c.base;
        } else {
            if (c) {
                dom = createNodeReplace(dom);
                unmountComponent(c);
            }
            out = createComponentFromVNode(dom, vnode, context);
        }
        return out;
    }


    function innerDiffNode(dom, vnode, context) {
        var len = dom.childNodes.length,
            childrenLen = 0,
            keyedLen = 0,
            children = [],
            keyed = {},
            key;

        if (len) {
            for (var idx = 0; idx < len; idx++) {
                var child = dom.childNodes[idx];
                key = child._component ? child._component.__key : getAccessor(child, 'key');

                if (!empty(key)) {
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

                if (keyedLen) {
                    var attrs = vchild.attributes;
                    key = attrs && attrs.key;
                    if (!empty(key) && hasOwnProperty(keyed, key)) {
                        child2 = keyed[key];
                        delete keyed[key];
                        keyedLen--;
                    }
                }

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

                if (!child2) {
                    child2 = document.createElement(isString(vchild.nodeName) ? vchild.nodeName : 'div');
                    dom.insertBefore(child2, dom.childNodes[i] || null);
                }

                child2 = diff(child2, vchild, context);

                if (dom.childNodes[i] !== child2) {
                    dom.insertBefore(child2, dom.childNodes[i] || null);
                }
            }
        }

        if (keyedLen) {
            for (key in keyed) {
                children[childrenLen++] = keyed[key];
            }
        }

        // 移除游离的子节点
        if (childrenLen) {
            removeOrphanedChildren(children);
        }
    }

    function diff(dom, vnode, context) {
        var originalAttributes = vnode.attributes,
            out = dom;

        while (isFunctionalComponent(vnode)) {
            vnode = buildFunctionalComponent(vnode, context);
        }

        if (isFunction(vnode.nodeName)) {
            out = buildComponentFromVNode(dom, vnode, context);
        } else if (isString(vnode)) {
            var type = getNodeType(dom);
            if (type === 3) {
                dom[TEXT_CONTENT] = vnode;
                out = dom;
            } else if (type === 1) {
                out = document.createTextNode(vnode);
                replaceNode(out, dom);
                recollectNodeTree(dom);
            }
        } else {
            var nodeName = vnode.nodeName || 'undefined';

            if (toLowerCase(dom.nodeName) !== nodeName) {
                out = createNode(nodeName);
                appendChildren(out, toArray(dom.childNodes));
                replaceNode(out, dom);
                recollectNodeTree(dom);
            }

            innerDiffNode(out, vnode, context);
            diffAttributes(out, vnode);

            if (originalAttributes && originalAttributes.ref) {
                (out[ATTR_KEY].ref = originalAttributes.ref)(out);
            }
        }
        return out;
    }


    /** 组件基类,createClass返回的的构造函数内自动调用.*/

    function Component(props, context) {
        this._dirty = this._disableRendering = this._isMounted = false;
        this._parentComponent = this._component = this.__ref = this.__key = null;
        this.prevState = this.prevProps = this.prevContext = this.base = null;

        this._renderCallbacks = [];
        this._linkedStates = {};
        this.context = context || {};
        this.props = props || {};
        this.state = hook(this, 'getInitialState') || {};
    }

    Component.prototype.shouldComponentUpdate = function(props, state, context) {
        return true;
    };
    Component.prototype.linkState = function(key, eventPath) {
        var c = this._linkedStates,
            cacheKey = key + '|' + (eventPath || '');

        return c[cacheKey] || (c[cacheKey] = createLinkedState(this, key, eventPath));
    };
    Component.prototype.setState = function(state, callback, isReplace) {
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
    Component.prototype.setProps = function(props, callback, isReplace) {
        if (typeof callback === 'boolean') {
            isReplace = callback;
            callback = null;
        }
        if (!this.prevProps) {
            this.prevProps = clone(this.props);
        }
        if (callback) {
            this._renderCallbacks.push(callback);
        }

        props = isFunction(props) ? props(this.state, this.props) : props;

        if (isReplace) {
            this.props = props;
        } else {
            extend(this.props, props);
        }

        setComponentProps(this, this.props, SYNC_RENDER, this.context);
    };
    Component.prototype.isMounted = function() {
        return this._isMounted;
    };
    Component.prototype.getDOMNode = function() {
        return this.base;
    };
    Component.prototype.forceUpdate = function(callback) {
        if (callback) {
            this._renderCallbacks.push(callback);
        }
        renderComponent(this);
    };
    Component.prototype.render = function(props, state) {
        return null;
    };
    Component.prototype._destroy = function() {
        this._dirty = this._disableRendering = this._isMounted = false;
        this.__ref = this.__key = null;
        this.prevState = this.prevProps = this.prevContext = null;

        this._renderCallbacks = [];
        this._linkedStates = {};
    };
    Component.prototype._reuse = function(props, context) {
        this.context = context || {};
        this.props = props || {};
        this.state = hook(this, 'getInitialState') || {};
        return this;
    };

    function createClass(obj) {

        function F() {
            Component.call(this);
        }

        F.prototype = Object.create(Component.prototype);

        if (obj.getDefaultProps) {
            F.defaultProps = obj.getDefaultProps();
            delete obj.getDefaultProps;
        } else {
            F.defaultProps = {};
        }

        for (var i in obj) {
            F.prototype[i] = obj[i];
        }

        return F.prototype.constructor = F;
    }

    return {
        h: h,
        hooks: options,
        options: options,
        rerender: rerender,
        Component: Component,
        createClass: createClass,
        render: function(merge, vnode) { return diff(merge, vnode); }
    };
})(window);

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

    var delve = function(obj, key) {
        var keys = key.split('.');
        for (var i = 0, len = keys.length; i < len && obj; i++) {
            obj = obj[keys[i]];
        }
        return obj;
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

    /** ******************************************  dom  ******************************************* */

    var EMPTY = {};

    var EMPTY_BASE = '';

    var TEXT_CONTENT = 'textContent' in document ? 'textContent' : 'nodeValue';

    var ATTR_KEY = typeof global.Symbol !== 'undefined' ? global.Symbol.for('reactattr') : '__reactattr_';

    var NON_DIMENSION_PROPS = {};

    ['boxFlex', 'boxFlexGroup', 'columnCount', 'fillOpacity', 'flex', 'flexGrow', 'flexPositive', 'flexShrink', 'flexNegative', 'fontWeight',
        'lineClamp', 'lineHeight', 'opacity', 'order', 'orphans', 'strokeOpacity', 'widows', 'zIndex', 'zoom'].forEach(function(val) {
            NON_DIMENSION_PROPS[val] = true;
        });

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
            var node = document.createTextNode('react'),
                queue = [],
                bool = false,
                callback = function() {
                    var n = queue.length;
                    for (var i = 0; i < n; i++) {
                        queue[i]();
                    }
                    queue = queue.slice(n);
                };

            new tickObserver(callback).observe(node, {
                characterData: true
            });

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

    var getNodeType = function(node) {
        return node.nodeType;
    };

    var ensureNodeData = function(node) {
        return node[ATTR_KEY] || (node[ATTR_KEY] = {});
    };

    /** fontSize -> font-size.*/

    var jsToCss = memoize(function(s) {
        return s.replace(/([A-Z])/g, '-$1').toLowerCase();
    });

    /** {zIndex:100, fontSize:14} -> 'z-index:100; font-size:14px;'.*/

    var styleObjToCss = function(s) {
        var str = '';
        for (var prop in s) {
            var val = s[prop];
            if (!empty(val)) {
                str += (jsToCss(prop) + ':' + val + (typeof val === 'number' && !NON_DIMENSION_PROPS[prop] ? 'px;' : ';'));
            }
        }
        return str;
    };

    /** {class1:true, class2:false, class3:1} -> 'class1 class3'.*/

    var hashToClassName = function(c) {
        var str = '';
        for (var prop in c) {
            if (c[prop]) {
                str += (str ? (' ' + prop) : prop);
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
            return ensureNodeData(node)[name];
        }
    };

    var normalizeEventName = memoize(function(t) {
        return t.replace(/^on/i, '').toLowerCase();
    });

    var eventProxy = function(event) {
        var fn = this._listeners[normalizeEventName(event.type)];

        return fn ? fn.call(this, optionsHook('event', event) || event) : void(0);
    };

    var setComplexAccessor = function(node, name, value) {
        if (name.substring(0, 2) === 'on') {
            var _type = normalizeEventName(name),
                l = node._listeners || (node._listeners = {}),
                act = value ? 'add' : 'remove';

            node[act + 'EventListener'](_type, eventProxy);
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

    /** ******************************************  vnode  ******************************************* */

    var SYNC_RENDER = {
        renderSync: true
    };

    extend(options, {
        syncComponentUpdates: false,
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

    function VNode(nodeName, attributes, children) {
        this.nodeName = nodeName;
        this.attributes = attributes;
        this.children = children;
    }

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

    function isFunctionalComponent(vnode) {
        var nodeName = vnode.nodeName;
        return isFunction(nodeName) && !nodeName.prototype.render;
    }

    function isComponent(vnode) {
        var nodeName = vnode.nodeName;
        return isFunction(nodeName) && isFunction(nodeName.prototype.render);
    }

    function isSameNodeType(node, vnode) {
        var nodeName = vnode.nodeName;

        if (isString(nodeName)) {
            return nodeName === toLowerCase(node.nodeName);
        } else if (isComponent(vnode)) {
            return nodeName === node._componentConstructor;
        } else if (isString(vnode)) {
            return 3 === getNodeType(node);
        } else {
            return true;
        }
    }

    /** 通过vNode来更新节点node的属性.*/

    function diffAttributes(dom, vnode) {
        var old = getNodeAttributes(dom) || EMPTY,
            attrs = vnode.attributes || EMPTY,
            name,
            value;

        // 移除
        for (name in old) {
            if (!hasOwnProperty(attrs, name)) {
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

    function replaceComponentNode(node, vnode, isCollectComponent) {
        var newNode = createNodeToVNode(vnode),
            nextNode = node.nextSibling || null,
            parentNode = node.parentNode;

        if (isCollectComponent) {
            recollectNodeTree(node);
        } else {
            collectNode(node);
            removeOrphanedChildren(node.childNodes);
        }

        return parentNode.insertBefore(newNode, nextNode);
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
                if (!hasOwnProperty(props, i)) {
                    props[i] = defaultProps[i];
                }
            }
        }

        return props;
    }

    function buildFunctionalComponent(vnode, context) {
        return vnode.nodeName(getNodeProps(vnode), context || EMPTY) || EMPTY_BASE;
    }

    /** DOM节点缓存池,以nodeName.toUpperCase()为键.*/

    var nodes_cache = {};

    function cleanNode(node) {
        if (getNodeType(node) === 1) {
            node._component = node._componentConstructor = null;
        }
    }

    function collectNode(node) {
        var attrs = getNodeAttributes(node),
            name = toUpperCase(node.nodeName),
            list = nodes_cache[name];

        hook(attrs, 'ref', null);
        removeNode(node);
        cleanNode(node);

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

    /** 组件DOM节点缓存池.*/

    var components_cache = {};

    function collectComponent(component) {
        var name = component.constructor.name,
            list = components_cache[name];

        component.clean();
        if (list) {
            list.push(component);
        } else {
            components_cache[name] = [component];
        }
    }

    function createComponent(ctor, props, context) {
        var list = components_cache[ctor.name],
            component = list && list.pop();
        if (component) {
            return ctor.call(component, props, context);
        } else {
            return new ctor(props, context);
        }
    }

    /** 回收所有子节点.*/

    function removeOrphanedChildren(children) {
        var len = children.length;
        while (len--) {
            var child = children[len];
            if (child) {
                recollectNodeTree(child);
            }
        }
    }

    /** 回收节点树.*/

    function recollectNodeTree(node) {
        var component = getAncestorComponent(node._component);

        if (component) {
            unmountComponent(component, true);
        } else {
            if (getNodeType(node) === 1) {
                collectNode(node);
                removeOrphanedChildren(node.childNodes);
            } else {
                removeNode(node);
            }
        }
    }

    /** 销毁组件.*/

    function unmountComponent(component, isCollectNode) {
        hook(component, '__ref', null);
        hook(component, 'componentWillUnmount');

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

        hook(component, 'componentDidUnmount');
        component._isMounted = true;
    }

    function createNodeToVNode(vchild) {
        if (isSimple(vchild)) {
            return document.createTextNode(String(vchild));
        } else {
            return isString(vchild.nodeName) ? document.createElement(vchild.nodeName) : document.createElement('div');
        }
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

    function getAncestorComponent(component) {
        while (component && component._parentComponent) {
            component = component._parentComponent;
        }
        return component;
    }

    function updateComponentBaseUp(component, base) {
        while (component) {
            component.base = base;
            component = component._parentComponent;
        }
    }

    function setComponentProps(component, props, opts, context) {
        component.__ref = props.ref;
        component.__key = props.key;
        delete props.ref;
        delete props.key;

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

        if ((opts && opts.SYNC_RENDER) || options.syncComponentUpdates) {
            renderComponent(component);
        } else {
            triggerComponentRender(component);
        }

        hook(component, '__ref', component);
    }

    /** 渲染组件.*/

    function renderComponent(component) {
        if (component._disableRendering) {
            return null;
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
            var vnode = hook(component, 'render', props, state, context),
                inst = component._component,
                cbase = component.base;

            while (isFunctionalComponent(vnode)) {
                vnode = buildFunctionalComponent(vnode, context);
            }

            if (!isComponent(vnode)) {
                inst && unmountComponent(inst);

                if (!isSameNodeType(cbase, vnode)) {
                    cbase = replaceComponentNode(cbase, vnode, false);
                    updateComponentBaseUp(component, cbase);
                }

                cbase._componentConstructor = component.constructor;
                cbase._component = component;
                diff(cbase, vnode);
            } else {
                var childComponent = vnode && vnode.nodeName,
                    childContext = component.getChildContext ? component.getChildContext() : context,
                    childProps = getNodeProps(vnode);

                if (inst && inst.constructor === childComponent) {
                    setComponentProps(inst, childProps, SYNC_RENDER, childContext);
                } else {
                    inst && unmountComponent(inst);
                    inst = buildAndRenderComponent(cbase, vnode, childContext);
                    component._component = inst;
                    inst._parentComponent = component;
                }
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
        return component;
    }

    /** 异步渲染组件.*/
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

    function triggerComponentRender(component) {
        if (!component._dirty) {
            component._dirty = true;
            enqueueRender(component);
        }
    }

    /** 构建组件, 新建或从缓存中获取.*/

    function buildAndRenderComponent(dom, vnode, context) {
        var component = createComponent(vnode.nodeName, getNodeProps(vnode), context);
        component.base = dom;
        return renderComponent(component);
    }

    function innerDiffNode(dom, vnode) {
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
                    child2 = createNodeToVNode(vchild);
                }
                if (child2 !== dom.childNodes[i]) {
                    dom.insertBefore(child2, dom.childNodes[i] || null);
                }
                render(child2, vchild);
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

    function diff(dom, vnode) {
        var originalAttributes = vnode.attributes,
            parent = dom.parentNode,
            next = dom.nextSibling,
            out = dom;

        if (isString(vnode)) {
            var type = getNodeType(dom);
            if (type === 3) {
                dom[TEXT_CONTENT] = vnode;
            } else if (type === 1) {
                out = document.createTextNode(vnode);
                recollectNodeTree(dom);
                parent.insertBefore(out, next);
            }
        } else {
            var nodeName = vnode.nodeName || 'undefined';

            if (toLowerCase(dom.nodeName) !== nodeName) {
                out = createNode(nodeName);
                recollectNodeTree(dom);
                parent.insertBefore(out, next);
            }

            innerDiffNode(out, vnode);
            diffAttributes(out, vnode);

            if (originalAttributes && originalAttributes.ref) {
                out[ATTR_KEY].ref = originalAttributes.ref;
                out[ATTR_KEY].ref(out);
            }
        }
    }

    /** 对某个节点进行渲染.*/

    function render(merge, vnode, context) {
        while (isFunctionalComponent(vnode)) {
            vnode = buildFunctionalComponent(vnode, context);
        }
        var mergeComponent = getAncestorComponent(merge._component);
        if (mergeComponent && vnode.nodeName === mergeComponent.constructor) {
            setComponentProps(mergeComponent, getNodeProps(vnode), SYNC_RENDER, context);
        } else {
            merge = mergeComponent ? replaceComponentNode(merge, vnode, true) : merge;

            if (isFunction(vnode.nodeName)) {
                buildAndRenderComponent(merge, vnode, context);
            } else {
                diff(merge, vnode);
            }
        }
    }

    /** 组件基类,createClass返回的的构造函数内自动调用.*/

    function Component(props, context) {
        this._dirty = this._disableRendering = this._isMounted = this._setProping = false;
        this._parentComponent = this._component = this.__ref = this.__key = null;
        this.prevState = this.prevProps = this.prevContext = this.base = null;
        this._renderCallbacks = [];
        this._linkedStates = {};
        this.context = context || {};
        this.props = props || {};
        this.state = hook(this, 'getInitialState') || {};
        return this;
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

        setComponentProps(this, props);
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
    Component.prototype.clean = function() {
        this._dirty = this._disableRendering = this._isMounted = false;
        this._parentComponent = this._component = this.__ref = this.__key = null;
        this.prevState = this.prevProps = this.prevContext = this.base = null;
        this._renderCallbacks.length = 0;
        this._linkedStates = this.context = this.props = this.state = {};
    };

    function createClass(obj) {
        var F_Name = String(Math.random() + Math.random()).replace(/\d\.\d{4}/, 'Component'),
            F = Function('Component', 'return function ' + F_Name + '() { return Component.apply(this, arguments);};')(Component);

        F.prototype = Object.create(Component.prototype);

        if (obj.getDefaultProps) {
            F.defaultProps = obj.getDefaultProps();
            delete obj.getDefaultProps;
        }
        for (var i in obj) {
            F.prototype[i] = obj[i];
        }

        return F.prototype.constructor = F;
    }

    return {
        h: h,
        hooks: options,
        render: render,
        rerender: rerender,
        Component: Component,
        createClass: createClass
    };
})(window);

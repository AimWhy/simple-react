var h = preact.h;

var Header = function (props, context) {
    return h('header', null, h('h1', null, props.prefix + props.name));
};
Header.defaultProps = { name: '头部' };


var Input = preact.createClass({
    componentWillMount: function () { console.log('Will-Input'); },
    componentDidMount: function () { console.log('Did-Input'); },
    render: function (props, state) {
        return h('input', { type: 'text', value: props.inputStr, oninput: props.inputCall });
    }
});

var Bottom = preact.createClass({
    componentWillMount: function () { console.log('Will-Bottom'); },
    componentDidMount: function () { console.log('Did-Bottom'); },
    getInitialState: function () {
        return { inputStr: 'ddd' };
    },
    inputCall: function (val) {
        this.setState({ inputStr: val.target.value });
    },
    render: function (props, state) {
        return h('div', null, h('label', null, props.prefix), h(Input, { inputStr: state.inputStr, inputCall: this.inputCall.bind(this) }), state.inputStr);
    }
});

var Content = preact.createClass({
    componentWillMount: function () { console.log('Will-Content'); },
    componentDidMount: function () { console.log('Did-Content'); },
    render: function (props, state) {
        var items = [1, 2, 3, 4, 5].map(function (item) {
            return h('li', { id: item }, props.name + props.children[0] + item, props.children[1]);
        });

        return h('ul', null, items);
    }
});

var Body = preact.createClass({
    componentWillMount: function () { console.log('Will-Body'); },
    componentDidMount: function () { console.log('Did-Body'); },
    render: function (props, state) {
        return h(Content, { name: props.prefix }, 'item', h(SubA));
    }
});

var SubA = preact.createClass({
    componentWillMount: function () { console.log('Will-SubA'); },
    componentDidMount: function () { console.log('Did-SubA'); },
    render: function (props, state) {
        return h('a', { href: 'https://www.baidu.com/' }, '链接');
    }
});




var App = preact.createClass({
    componentWillMount: function () { console.log('Will-App'); },
    componentDidMount: function () { console.log('Did-App'); },
    render: function (props, state) {
        return h('div', null, h(Header, { prefix: 'head：' }), h(Body, { prefix: 'body-' }), h(Bottom, { prefix: 'bottom：' }));
    }
});

preact.render(h(App), document.body);

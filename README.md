**fast, `3kb` alternative to React, with the same ES2015 API.**


| Lifecycle method            | When it gets called                              |
|-----------------------------|--------------------------------------------------|
| `componentWillMount`        | before the component gets mounted to the DOM     |
| `componentDidMount`         | after the component gets mounted to the DOM      |
| `componentWillUnmount`      | prior to removal from the DOM                    |
| `componentDidUnmount`       | after removal from the DOM                       |
| `componentWillReceiveProps` | before new props get accepted                    |
| `shouldComponentUpdate`     | before `render()`. Return `false` to skip render |
| `componentWillUpdate`       | before `render()`                                |
| `componentDidUpdate`        | after `render()`                                 |

```html
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">

<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <title></title>
</head>

<body>
    <div id="why"></div>
    <script src="../preact.js"></script>
    <script>
        var h = preact.h;
        var createClass = preact.createClass;
        var render = preact.render;

        var Clock = createClass({
            getInitialState: function () {
                return { time: Date.now() }
            },

            componentDidMount: function () {
                var that=this;
                this.timer = setInterval(function () {
                    that.setState({ time: Date.now() });
                }, 1000);
            },

            componentWillUnmount: function () {
                clearInterval(this.timer);
            },

            render: function (props, state) {
                var time = new Date(state.time).toLocaleTimeString();
                return h('span', null, time);
            }
        });

        render(document.getElementById('why'), h(Clock));
    </script>
</body>

</html>
``` 

modify from [preact](https://github.com/developit/preact)


// 基类
class Vue {
    constructor(options) {
        this.$el = options.el;
        this.$data = options.data;
        this.computed = options.computed; 
        this.methods = options.methods; // 其实computed、methods这些内容，都用数据劫掠的形式绑定在vm.$data上，方面后续调用执行
        // 判断根元素是否存在，存在则编译模版
        if (this.$el) {
            // 数据劫持！！！
            // 把data中的数据全用Object.defineProperty来定义
            new Observer(this.$data); // 数据是被观察者，被观察一旦改变则立马执行观察者的方法
            console.log(this.$data);

            for(let key in this.computed){ // computed内的方法是和vm.$data中的数据有依赖关系，
                // computed中的方法也会根据数据的变动而变动，直接获取即可
                Object.defineProperty(this.$data,key,{ // 需要在this.$data中寻找！！！因为到时是vm.$data.school
                    get:()=>{
                        // console.log("!!~~~~");
                        // computed在页面中也是有双括号的！
                        return this.computed[key].call(this); // 因为是this.school.name+"学校";需要保证this指向正确
                    }
                })
            }
            for(let key in this.methods){ // computed内的方法是和vm.$data中的数据有依赖关系，
                // computed中的方法也会根据数据的变动而变动，直接获取即可
                Object.defineProperty(this,key,{ // 直接在this上访问！！！因为到时是vm.change
                    get:()=>{
                        console.log("!!~~~~");
                        // computed在页面中也是有双括号的！
                        return this.methods[key]; // 因为是this.school.name+"学校";需要保证this指向正确
                    }
                })
            }

            // 把数据获取操作（vm上的取值操作）都代理到vm.$data上
            this.proxyVm(this.$data);

            // 注意！！！！！！！！！！！！！！！编译这条语句务必放在后面，因为computed中的数据需要先被劫掠，然后才是编译！！！
            new Compile(this.$el, this);

        }
    }
    proxyVm(data){
        for(let key in data){
            Object.defineProperty(this,key,{ // this的意思就是vm。相当于vm.school
                get(){
                    return data[key]; // 实际上就是去到vm.$data上获取
                },
                set(newValue){
                    data[key] = newValue;
                }
            })
        }
    }
}
// 实现数据劫掠功能
class Observer {
    constructor(data) {
        this.observer(data); // 观察data中所有的数据
        console.log(data);
    }
    observer(data) {
        // 如果是对象，才观察
        if (data && typeof (data) === 'object') {
            // 如果是存在且是对象
            for (let key in data) {
                // 观察每个属性！
                this.defineReactive(data, key, data[key]);
            }
        }
    }
    defineReactive(obj, key, value) {
        // 注意，value如果是对象类型的，还需要下一层设置Object.defineProperty，所以需要递归
        this.observer(value);
        // TODO: 注意，每一个属性其实都是一个被观察者！！！
        let dep = new Dep();
        Object.defineProperty(obj, key, {
            get() {
                // 每个数据肯定会先被获取
                // 也就是在创建watcher的时候，会取到对应的内容，并且把watcher放在全局上了。
                // console.log("触发get!!!~~~",key);
                Dep.target && dep.addWatcher(Dep.target);
                return value;
            },
            set: (newValue) => {
                if (newValue !== value) {
                    console.log("!!!!");

                    // 也许赋值有可能是对象进行赋值，则需要重新观察
                    this.observer(newValue);
                    value = newValue;
                    dep.notify(); // 一旦更新，则通知所有观察者
                }
            }
            // 实际上，就是在获取变量的时候，就加入当前对应的观察者，然后在更新数据的时候，就通知这些观察者
            // 
        })
    }
}

// 观察者模式，一旦被观察数据变化，则重新编译！
// 观察者是需要放到被观察者内部的，被观察者数据一变就要更新视图
// vm.$watch(vm,'school.name',(newValue)=>{})
class Watcher {
    constructor(vm, expre, callback) {
        // 实际上就是新旧值进行比对，如果有变化就执行callback函数
        this.vm = vm;
        this.expre = expre;
        this.callback = callback;
        // 先默认存一个旧值
        this.oldValue = this.get();
    }
    get() {
        Dep.target = this; // 给全局的类，设定一个target，为了方便给被观察者添加观察者
        let value = ComplieUtil.getValue(this.vm, this.expre); // 会出发Object.defineProperty的get方法
        // 一旦获取完数据的时候，也就是给dep添加好观察者的时候，就会删掉当前的放在全局的观察者
        Dep.target = null;  // 如果不取消，每个数据都会添加watcher，也就是其中一个数据改变，全部的watcher都会变化
        return value;
        // TODO: 实际上就是，把当前的观察者放在全局的Dep类中，在取值的时候出发get()方法，将这个观察者放入到被观察者中（在这里实现了数据与观察者关联，也就是对应的数据会执行对应的set方法，也就会精准地去执行notify）。
        // 也就是实现，某一个数据变化，就能准确对应某个视图的更新
        // 就比如a:[watcher1,wathcer2],b:[watcher3]，如果a中数据改变只会精准改变watcher1和watcher2
    }
    // 数据变化后会调用观察者的update方法
    update() {
        let newValue = ComplieUtil.getValue(this.vm, this.expre);
        if (newValue !== this.oldValue) {
            this.callback(newValue); // 实际上就是去执行被观察者的回调函数
        }
    }
}
// 订阅（实际上就是被观察者，需要存放观察者）
// 到时数据一变，就要通知观察者数据更新
class Dep {
    constructor() {
        this.watchers = []; // 存放所有watcher
    }
    // （类似于订阅）
    addWatcher(watcher) {
        this.watchers.push(watcher);
    }
    // （类似于发布）
    notify() {
        // 通知所有观察者执行update函数
        this.watchers.forEach((watcher) => {
            watcher.update();
        })
    }
}
// 编译模版
class Compile {
    // 接受参数为，根元素和实例
    constructor(el, vm) {
        this.el = this.toElementNode(el);
        this.vm = vm;
        // 将DOM元素转变成虚拟DOM！！！
        // 相当于将HTML中DOM树转变为对象形式保存下来
        let fragment = this.node2fragment(this.el);
        console.log(fragment);
        // 接着把模版内容进行替换（在虚拟DOM上操作）

        // 用数据进行编译模版
        this.compile(fragment, this.vm); // 用vm中的数据进行编译
        // 最后把替换好的模版内容加入到页面HTML中
        this.el.appendChild(fragment); // 重新移动回el中
    }
    // 判断el是dom还是字符串，最后输出都输DOM
    toElementNode(el) {
        if (el.nodeType === 1) { // 是DOM元素
            return el;
        } else {
            return document.querySelector(el);
        }
    }
    // 建立虚拟dom树
    node2fragment(node) {
        let fragment = document.createDocumentFragment();
        let firstChild;
        while (firstChild = node.firstChild) {
            // 每次去获取一个结点，利用appendChild具有移动性（剪切粘贴）的特质循环
            fragment.appendChild(firstChild);
        }
        return fragment;
    }
    // 用来编译内存中（fragment对象）的DOM结点
    compile(node, vm) {
        let childNodes = node.childNodes; // childNodes是所有当前层的子结点，不包含子孙结点 
        // console.log(childNodes); // NodeList(7) [text, input, text, div, text, ul, text]
        // 在元素中查找有没有v-model和{{}}
        [...childNodes].forEach((child) => {
            // 将childNode转变成数组
            if (child.nodeType === 1) { // 判断是否是元素
                // console.log("childNode",child);
                this.compileElement(child);
                // 注意了，如果是元素的，需要进行下一层递归去遍历子节点。比如<div>{{school.name}}</div>，需要进入下一层递归获取{{school.name}}
                this.compile(child, vm);
            } else {
                // console.log("text",child);
                this.compileText(child);
            }
        })
    }
    // 编译元素
    compileElement(node) {
        let attributes = node.attributes; // 获得的是类数组
        // console.log(attributes); // NamedNodeMap {0: type, 1: v-model, type: type, v-model: v-model, length: 2}
        // 逐个去获取属性，然后替换
        [...attributes].forEach((attr) => { // 获取的attr有，type="text",v-model="school.name"
            let { name, value } = attr;
            // console.log(name,value);
            // 判断是不是指令
            if (this.isDirective(name)) { // 有v-model,v-bind,v-html等
                // console.log("带有v-的DOM元素", node);
                let directive = name.split('-')[1];
                // 如果是v-on:click
                let [directiveName,eventName] = directive.split(":"); 
                // 调用编译替换工具进行操作，需要调用不同的指令进行替换处理
                ComplieUtil[directiveName](node, value, this.vm,eventName); // 需要通过value去获取this.vm实例中的值
            }
        })
    }
    // 判断是不是指令
    isDirective(attrName) {
        // 查找是否带有v-model的属性
        return attrName.startsWith('v-');
    }
    // 编译文本
    compileText(node) {
        // 首先判断文本节点中的内容是否包含{{}}
        let content = node.textContent;
        if (/\{\{(.+?)\}\}/.test(content)) {
            // console.log("具有双括号的内容", content);
            ComplieUtil['text'](node, content, this.vm);
        }
    }
}

// 编译替换工具
ComplieUtil = {
    // 根据表达式获取对应vm中的数据 
    getValue(vm, expre) {
        // 比如school.name，分割'.'然后逐个去获取
        // console.log("getValue!!!!!~~~~",expre);
        let arr = expre.split('.');
        let re =  arr.reduce((item, current) => {
            return item[current];
        }, vm.$data);
        return re;
    },
    setValue(vm,expre,value){
        // 相当于给实例上的数据赋值 vm.$data.xxx.xxx = 'xxx';
        let arr = expre.split('.');
        return arr.reduce((item, current,index,arr) => {
            // 取到最后的时候，就赋值
            if(index === arr.length -1){
                return item[current] = value; // 赋值，然后就会自动更新视图了！
            }
            return item[current];
        }, vm.$data);
    },
    // 有v-model,v-bind,v-html等
    model(node, expre, vm) {
        // node是当前需要替换的结点，expre是替换的参数（可以是表达式如school.name），vm是整个实例
        // 比如<div>{{school.name}}</div>，通过school.name在vm中寻找对应的变量
        let value = this.getValue(vm, expre); // 直接获取对应的属性‘xxx’
        let fn = this.updater['modelUpdater'];
        // 给输入框赋予value属性
        fn(node, value);
        // TODO: 注意了，需要在这里给输入框添加观察者！观察当前v-model对应的内容
        new Watcher(vm, expre, (newValue) => {
            // 注意，这里的回调函数，是指被观察者的回调函数，也就是重新赋值
            fn(node, newValue); // 数据一更新，视图也会跟着更新！！！实际上就是数据一变化就重新刷新页面
        })
        // 为input添加事件
        node.addEventListener('input',(e)=>{
            let value = e.target.value; // 获取用户输入的值
            // console.log("!!!!!",value);
            this.setValue(vm,expre,value);
        })
    },
    on(node,expre,vm,eventName){
        // 其中的expre是   "change"
        node.addEventListener(eventName,(e)=>{
            vm[expre].call(vm,e); // 直接获取，然后执行
            alert(expre);
        })
    },
    getContentValue(vm, expre) {
        // 遍历表达式，重新将内容替换成一个完整的字符串（比如{{school.name}}重新变成xxxx）
        return expre.replace(/\{\{(.+?)\}\}/g, (...agrs) => {
            return this.getValue(vm,agrs[1]);
        })
    },
    text(node, expre, vm) {
        // 比如{{school.name}}
        // 注意有可能是{{a}} {{b}} {{c}}
        let fn = this.updater['textUpdater'];
        let content = expre.replace(/\{\{(.+?)\}\}/g, (...agrs) => {
            // TODO: 同样道理，给每个表达式（a,b,c）添加观察者，一旦变化就更新
            new Watcher(vm, agrs[1], (newValue) => {
                let value = this.getContentValue(vm, expre); // 返回一个全的字符串
                fn(node, value);
            })
            return this.getValue(vm, agrs[1]); // 讲{{school.name}}替换成xxx
        })
        console.log({content});
        fn(node, content);
    },
    bind() {

    },
    html() {

    },
    updater: {
        modelUpdater(node, value) {
            // 把数据替换到html上
            node.value = value;
        },
        textUpdater(node, value) {
            // 将文本内容替换到文本节点上
            // console.log("!!!!!!!!!!!!!!!!",value);
            node.textContent = value;
        }
    }
}



// 还有个功能，vm.school和vm.$data.school有同样效果    也就是代理proxy
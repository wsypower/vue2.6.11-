/* @flow */

import config from "../config";
import { initProxy } from "./proxy";
import { initState } from "./state";
import { initRender } from "./render";
import { initEvents } from "./events";
import { mark, measure } from "../util/perf";
import { initLifecycle, callHook } from "./lifecycle";
import { initProvide, initInjections } from "./inject";
import { extend, mergeOptions, formatComponentName } from "../util/index";

let uid = 0;

export function initMixin(Vue: Class<Component>) {
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this;
    // a uid
    // 实例唯一id
    // 是一个全局共享的变量，并不在构造函数中
    // 因此每次调用都会 + 1
    // 这样可以确保每个组件的_uid 都不一样
    vm._uid = uid++;

    let startTag, endTag;
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== "production" && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`;
      endTag = `vue-perf-end:${vm._uid}`;
      mark(startTag);
    }

    // a flag to avoid this being observed
    // 内部标记，主要用于防止被当成普通对象来监听变化
    vm._isVue = true;
    // merge options 合并选项 参数
    // 如果选项_isComponent 为 true，则说明组件是一个自定义组件
    // 会调用 initInternalComponent 方法
    // 会写入 parent / _parentVnode / propsData / _parentListeners / _renderChildren / _componentTag 属性
    // 如果 render 选项存在，还会写入 render / staticRenderFns。
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      //优化内部组件实例化
      //因为动态选项合并非常慢，没有一个是内部组件选项需要特殊处理。
      //初始化内部组件
      initInternalComponent(vm, options);
    } else {
      //合并参数 将两个对象合成一个对象 将父值对象和子值对象合并在一起
      //并且优先取值子值，如果没有则取子值

      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm // vm 实例本身的属性（也就是说包括上面的_uid 之类的都会合并进去）
      );
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== "production") {
      //初始化 代理 监听
      //实例的 Proxy 包装代理，当在开发环境访问不存在的属性时产生提示
      initProxy(vm);
    } else {
      vm._renderProxy = vm;
    }
    // expose real self 暴露真实的self
    vm._self = vm;
    initLifecycle(vm); //初始化生命周期 标志
    initEvents(vm); //初始化事件
    initRender(vm); // 初始化渲染 Render
    callHook(vm, "beforeCreate"); //触发beforeCreate钩子函数
    //初始化依赖注入 Injections
    //在数据/道具之前解决注入问题,初始化 inject
    initInjections(vm);
    // 响应话数据
    initState(vm);
    //解决后提供数据/道具  provide 选项应该是一个对象或返回一个对象的函数。
    //该对象包含可注入其子孙的属性，用于组件之间通信。
    //初始化依赖注入 Provide
    initProvide(vm);
    //触发created钩子函数
    callHook(vm, "created");

    /* istanbul ignore if */
    //浏览器 性能监听
    if (process.env.NODE_ENV !== "production" && config.performance && mark) {
      vm._name = formatComponentName(vm, false);
      mark(endTag);
      measure(`vue ${vm._name} init`, startTag, endTag);
    }

    if (vm.$options.el) {
      // Vue 的$mount()为手动挂载，
      // 在项目中可用于延时挂载（例如在挂载之前要进行一些其他操作、判断等），之后要手动挂载上。
      // new Vue时，el和$mount并没有本质上的不同。
      vm.$mount(vm.$options.el);
    }
  };
}
//初始化内部组件
export function initInternalComponent(
  vm: Component, //vue实例
  options: InternalComponentOptions //选项参数
) {
  //vm的参数
  const opts = (vm.$options = Object.create(vm.constructor.options));
  // doing this because it's faster than dynamic enumeration.
  // 这样做是因为它比动态枚举快。
  // var options = {
  //     _isComponent: true, //是否是组件
  //     parent: parent, //组件的父节点
  //     _parentVnode: vnode, //组件的 虚拟vonde 父节点
  //     _parentElm: parentElm || null, //父节点的dom el
  //     _refElm: refElm || null //当前节点 el
  // }
  const parentVnode = options._parentVnode;
  //组件的父节点
  opts.parent = options.parent;
  //组件的 虚拟vonde 父节点
  opts._parentVnode = parentVnode;
  //组件参数
  const vnodeComponentOptions = parentVnode.componentOptions;
  //组件数据
  opts.propsData = vnodeComponentOptions.propsData;
  //组件 事件
  opts._parentListeners = vnodeComponentOptions.listeners;
  //组件子节点
  opts._renderChildren = vnodeComponentOptions.children;
  //组件的标签
  opts._componentTag = vnodeComponentOptions.tag;
  //渲染函数
  if (options.render) {
    //渲染函数
    opts.render = options.render;
    //静态渲染函数
    opts.staticRenderFns = options.staticRenderFns;
  }
}
// 解析new Vue constructor上的options拓展参数属性的 合并 过滤去重数据
export function resolveConstructorOptions(Ctor: Class<Component>) {
  // constructor上的options参数属性
  let options = Ctor.options;
  // 有super属性，说明Ctor是Vue.extend构建的子类 继承的子类
  // 超类
  if (Ctor.super) {
    //回调超类 表示继承父类
    const superOptions = resolveConstructorOptions(Ctor.super);
    // Vue构造函数上的options,如directives,filters,....
    const cachedSuperOptions = Ctor.superOptions;
    //判断如果 超类的options不等于子类的options 的时候
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      //超级选项改变，
      //需要解决新的选项。
      //让他的超类选项赋值Ctor.superOptions
      Ctor.superOptions = superOptions;
      // check if there are any late-modified/attached options (#4976)
      // 解决修改选项 转义数据 合并 数据
      const modifiedOptions = resolveModifiedOptions(Ctor);
      // update base extend options
      // 更新基本扩展选项
      if (modifiedOptions) {
        //extendOptions合并拓展参数
        extend(Ctor.extendOptions, modifiedOptions);
      }
      // 优先取Ctor.extendOptions 将两个对象合成一个对象 将父值对象和子值对象合并在一起，并且优先取值子值，如果没有则取子值
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions);
      //如果参数含有name 组件name
      if (options.name) {
        options.components[options.name] = Ctor;
      }
    }
  }
  //返回参数
  return options;
}
//解决修改options 转义数据 合并 数据
function resolveModifiedOptions(Ctor: Class<Component>): ?Object {
  let modified;
  //获取选项
  const latest = Ctor.options;
  //获取拓展的选项
  const sealed = Ctor.sealedOptions;
  //遍历最新选项
  for (const key in latest) {
    //如果选项不等于子类选项
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {};
      modified[key] = latest[key];
    }
  }
  //返回合并后的参数
  return modified;
}

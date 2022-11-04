let activeEffect = null
let effectStack = [] //effect栈  解决effect嵌套问题
let budget = new WeakMap()

let obj = {
  index: 1
}
/**
 * Proxy
 */
const proxyObj = new Proxy(obj,{
  get(target,key){
    track(target,key)
    return target[key]
  },
  set(target,key,value){
    target[key] = value
    trigger(target,key)
  }
})

//收集 副作用函数
function track(target,key){
  if(!activeEffect)return
  let dspMap = budget.get(target)
  if(!dspMap){
    dspMap = new Map()
    budget.set(target,dspMap)
  }
  let sets = dspMap.get(key)
  if(!sets){
    sets = new Set()
    dspMap.set(key,sets)
  }
  sets.add(activeEffect)
  activeEffect.deps.push(sets)
}

//触发 副作用函数
function trigger(target,key){
  const dspMap = budget.get(target)
  if(!dspMap)return
  const effects = dspMap.get(key)
  if(!effects)return
  const effectsToRun = new Set()
  effects.forEach(effectFunc => {
    //避免无限循环  当trigger 触发的副作用函数与正在执行的副作用函数相等，则不触发执行
    if(activeEffect !== effectFunc){
      effectsToRun.add(effectFunc)
    }
  })
  effectsToRun.forEach(effectFunc => {
    if(effectFunc.options.scheduler){
      //新增调度函数
      effectFunc.options.scheduler(effectFunc)
    }else{
      effectFunc()
    }
  })
}

function cleanup(effectFn){
  for (let index = 0; index < effectFn.deps.length; index++) {
    const sets = effectFn.deps[index];
    sets.delete(effectFn)
  }
  effectFn.deps.length = 0
}

//注册副作用函数
function effect(func,options) {
  const effectFunc = () => {
    //清除副作用函数
    cleanup(effectFunc)
    activeEffect = effectFunc
    effectStack.push(effectFunc) //入栈
    const res = func() //获取副作用函数返回值
    effectStack.pop() //出栈
    activeEffect = effectStack[effectStack.length - 1]
    return res
  }
  effectFunc.options = options //挂载参数
  effectFunc.deps = [] //用来存储所有与该副作用函数相关的 依赖集合
  if(!options.lazy){
    effectFunc()
  }
  return effectFunc
}
/**
 * 
 * 1、分支切换与cleanup
 * 2、嵌套effect问题
 * 3、无限递归循环
 */

//测试


effect(() => {
  console.log(proxyObj.index)
})


Promise.resolve().then(() => {
  proxyObj.index = proxyObj.index + 1
})

//赖计算，计算缓存，
function computed(getter) {
  let value, dirty = true
  const effectFn = effect(getter,{
    lazy: true,
    scheduler(){
      if(!dirty){
        dirty = true
        trigger(obj,"value")
      }
    }
  })
  const obj = {
    get value(){
      if(dirty){
        value = effectFn()
        dirty = false
      }
      track(obj,"value")
      return value
    }
  }
  return obj
}

function watch(source,cb){
  let newValue,oldValue

  const effectFn = effect(()=> source(),{
    scheduler(){
      newValue = effectFn()
      cb(newValue,oldValue)
      oldValue = newValue
    },
    lazy:true
  })
  oldValue = effectFn()
}
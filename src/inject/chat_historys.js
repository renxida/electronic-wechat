/**
 * Created by kooritea on 26/6/18.
 */
'use strict';
const { ipcRenderer } = require('electron');
var easyIDB = require('../lib/easyIDB.js')

class ChatHistorys{

  init(){
    this.initIndexDB()
    this.initEvent()
  }

  async initIndexDB(){
    let self = this
    if (!angular.element('.header').scope().account) {
      setTimeout(()=>{
        this.initIndexDB()
      }, 1000);
      return
    }
    console.log('初始化IndexDB')
    this.selfUserName = angular.element('.header').scope().account.UserName
    this.DBName = 'Uin'+angular.element('.header').scope().account.Uin
    this.myIDB = await easyIDB({name:this.DBName,ver:1},[
      {
        name:'history',
        indexs:[
          {
            name:'PYQuanPin',
            unique:false
          },
          {
            name:'RemarkPYQuanPin',
            unique:false
          },
          {
            name:'NickName',
            unique:false
          }
        ],
        option:{
          keyPath:'id',//主键,默认 'id'
          autoIncrement:true//是否自增,默认 true
        }
      }
    ])
    angular.element('#chatArea').scope().$watch('currentUser',this.restoreChatContent.bind(this));
    this.initData()
  }

  initData(){
    //把所有历史信息读取到内存中
    console.log('获取所有历史记录')
    try{
      this.myIDB.DB.tmp=false
      if(!this.myIDB.DB.name){
        throw 'error'
      }
    }
    catch(e){
      console.log(e)
      console.log('indexDB未初始化完成，1s后重试(2)')
      setTimeout(()=>{
        this.getHistory(user)
      },1000)
      return
    }
    this.AllChatHistorys={}
    window.AllChatHistorys = this.AllChatHistorys
    this.myIDB.get('history').then((data)=>{
      for(let item of data){
        if(!this.AllChatHistorys[item.NickName]){
          this.AllChatHistorys[item.NickName]={
            chats:[],
            get:0//已读取到聊天对象的条数
          }
        }
        this.AllChatHistorys[item.NickName].chats.push(item)
      }
      this.readAllChats=true
    })
  }

  initEvent(){
    let target = angular.element('#chatArea .scroll-wrapper>.scroll-content')[0]
    let loadHisStatus=document.createElement("div");
    loadHisStatus.style="position:absolute;width:calc(100% - 38px);top:-20px;text-align:center;height:13px;font-size:13px;line-height:13px;"
    loadHisStatus.id="loadHisStatus"
    angular.element('#chatArea .scroll-wrapper')[0].appendChild(loadHisStatus)

    target.addEventListener('scroll',()=>{
      this.debounce(()=>{
        if(target.scrollTop===0){
          if(!this.lockScroll&&angular.element('#chatArea').scope()){
            this.lockscroll=true
            loadHisStatus.innerHTML="加载中"
            loadHisStatus.style.top='20px'
            setTimeout(()=>{
                this.getHistory(angular.element('#chatArea').scope().currentUser)
            })
          }
        }
      },500)
    })
    window.onmousewheel = (event)=>{
      this.debounce(()=>{
        if(target.scrollHeight>target.clientHeight){
          return
        }
        if(event.clientX>angular.element('.panel')[0].scrollWidth&&event.clientY<angular.element('.box_hd')[0].scrollHeight+angular.element('#chatArea>.box_bd')[0].scrollHeight&&event.deltaY<0){
            if(!this.lockScroll&&angular.element('#chatArea').scope()){
              this.lockscroll=true
              loadHisStatus.innerHTML="加载中"
              loadHisStatus.style.top='20px'
              setTimeout(()=>{
                this.getHistory(angular.element('#chatArea').scope().currentUser)
              })
            }
        }
      },500)
    };
  }

  saveHistory(msg){//保存聊天记录到indexDB
    if(!msg.Content){
      return
    }
    try{
      this.myIDB.DB.tmp=false
      if(!this.myIDB.DB.name){
        throw 'error'
      }
    }
    catch(e){
      console.log(e)
      console.log('indexDB未初始化完成，1s后重试(1)')
      setTimeout(()=>{
        this.saveHistory(msg)
      },1000)
      return
    }
    setTimeout(()=>{
      msg.MMStatus=2
      if(msg.sendByLocal||msg.FromUserName===this.selfUserName){
        msg.NickName = msg.FromUserName==='filehelper'?'filehelper':window._contacts[msg.ToUserName].NickName
        msg.PYQuanPin = msg.FromUserName==='filehelper'?'filehelper':window._contacts[msg.ToUserName].PYQuanPin
        msg.RemarkPYQuanPin = msg.FromUserName==='filehelper'?'filehelper':window._contacts[msg.ToUserName].RemarkPYQuanPin
      }
      else{
        msg.NickName = msg.ToUserName==='filehelper'?'filehelper':window._contacts[msg.FromUserName].NickName
        msg.PYQuanPin = msg.ToUserName==='filehelper'?'filehelper':window._contacts[msg.FromUserName].PYQuanPin
        msg.RemarkPYQuanPin = msg.ToUserName==='filehelper'?'filehelper':window._contacts[msg.FromUserName].RemarkPYQuanPin
      }
      if(/@@/.test(msg.FromUserName)){
        //群聊需要记录发送者的信息
        //在群的memberlist里查找
        let info = msg.Content.match(/@(.*)?:<br\/>(.*)?/)
        let members= window._contacts[msg.FromUserName].MemberList
        for(let member of members){
          if(member.UserName === '@'+info[1]){
            msg.MMActualSenderNickName = member.NickName
            msg.MMActualSenderPYQuanPin = member.PYQuanPin
            msg.MMActualSenderRemarkPYQuanPin = member.RemarkPYQuanPin
            break
          }
        }
      }
      if(msg.$$hashKey){
        delete msg.$$hashKey
      }
      this.myIDB.push('history',msg)
    })
  }

  restoreChatContent(user) {
    const scope = angular.element('#chatArea').scope();
    if (!scope.chatContent || scope.chatContent.length === 0) {
      this.getHistory(user)
    }
  }

  getHistory(user){
    try{
      const scope = angular.element('#chatArea').scope();
      if(!this.readAllChats){
        setTimeout(()=>{
          this.restoreChatContent(user)
        },500)
        return
      }
      if(!user){
        return
      }
      let chatsObj
      let $loadHisStatus = document.getElementById('loadHisStatus')
      if(user === 'filehelper'){
        if(!this.AllChatHistorys.filehelper){
          $loadHisStatus.innerHTML="已经没有了"
          $loadHisStatus.style.top='-20px'
          return
        }
        chatsObj = this.AllChatHistorys.filehelper
      }
      else{
        if(!this.AllChatHistorys[window._contacts[user].NickName]){
          //没有聊天记录自然AllChatHistorys里没有对应的键
          this.lockscroll=true
          $loadHisStatus.innerHTML="已经没有了"
          $loadHisStatus.style.top='-20px'
          return
        }
        chatsObj = this.AllChatHistorys[window._contacts[user].NickName]
      }
      let start = chatsObj.chats.length - chatsObj.get - 1
      let end = start-4>=0?start-4:0;
      let his = chatsObj.chats
      for (let i=start;i>=end;i--) {
        if(his[i].MsgType === 10000){
          //撤回消息的提示
          //暂时没找到复原方法
          chatsObj.get++
          continue
        }
        if(/@@/.test(user)){
          //群聊
          //根据NickName在群成员中查找MMActualSender
          his[i].MMPeerUserName = user;
          if(his[i].sendByLocal){
            his[i].FromUserName = this.selfUserName;
            his[i].ToUserName = user
            his[i].MMActualSender = this.selfUserName
          }
          else{
            for(let member of window._contacts[user].MemberList){
              if(member.NickName == his[i].MMActualSenderNickName){
                his[i].MMActualSender = member.UserName
                break
              }
            }
            his[i].FromUserName =  user
            his[i].ToUserName = this.selfUserName;
          }

        }
        else{
          //私聊
          if(his[i].sendByLocal){
            //自己发的消息
            his[i].MMActualSender=this.selfUserName
            his[i].FromUserName = this.selfUserName
            his[i].ToUserName = user;
          }
          else{
            his[i].MMActualSender=user
            his[i].FromUserName = user
            his[i].ToUserName = this.selfUserName;
          }
          his[i].MMPeerUserName = user;
        }
        his[i].MMUnread = false;
        scope.chatContent.unshift(his[i]);
        chatsObj.get++
      }
      if(chatsObj.chats.length!==chatsObj.get+1){
        $loadHisStatus.innerHTML="获取成功"
      }
      else{
        $loadHisStatus.innerHTML="已经没有了"
      }
    }
    catch(e){
      $loadHisStatus.innerHTML="获取失败"
      console.error(e)
      console.error(user)
    }
    setTimeout(()=>{
      this.lockscroll=true
      document.getElementById('loadHisStatus').style.top='-20px'
    },1000)
  }

  // getHistory(user){//PYQuanPin,RemarkPYQuanPin
  //   try{
  //     if(!user){
  //       return
  //     }
  //     this.myIDB.DB.tmp=false
  //     if(!this.myIDB.DB.name){
  //       throw 'error'
  //     }
  //   }
  //   catch(e){
  //     console.log(e)
  //     console.log('indexDB未初始化完成，1s后重试(2)')
  //     setTimeout(()=>{
  //       this.getHistory(user)
  //     },1000)
  //     return
  //   }
  //   let NickName = user==='filehelper'?'filehelper':window._contacts[user].NickName
  //   let PYQuanPin = user==='filehelper'?'filehelper':window._contacts[user].PYQuanPin
  //   let RemarkPYQuanPin = user==='filehelper'?'filehelper':window._contacts[user].RemarkPYQuanPin
  //   if(/@@/.test(user)){
  //     //群聊优先匹配NickName
  //     if(NickName){
  //       return this.myIDB.get('history','NickName',NickName)
  //     }else if(PYQuanPin){
  //       return this.myIDB.get('history','PYQuanPin',PYQuanPin)
  //     }else if(RemarkPYQuanPin){
  //       return this.myIDB.get('history','RemarkPYQuanPin',RemarkPYQuanPin)
  //     }
  //   }
  //   else{
  //     if(RemarkPYQuanPin){
  //       return this.myIDB.get('history','RemarkPYQuanPin',RemarkPYQuanPin)
  //     }
  //     else if(PYQuanPin){
  //       return this.myIDB.get('history','PYQuanPin',PYQuanPin)
  //     }
  //     else if(NickName){
  //       return this.myIDB.get('history','NickName',NickName)
  //     }
  //   }
  // }
  debounce(func){//防抖
    clearTimeout(this.timer)
    this.timer = setTimeout(()=>{
      func()
    },300)
  }
}
module.exports = ChatHistorys;

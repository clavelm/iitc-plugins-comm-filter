// ==UserScript==
// @id             iitc-plugin-comm-filter@udnp
// @name           IITC plugin: COMM Filter
// @author         udnp
// @category       COMM
// @version        0.4.1.20160328.164226
// @namespace      https://github.com/jonatkins/ingress-intel-total-conversion
// @source         https://github.com/udnp/iitc-plugins
// @updateURL      https://github.com/udnp/iitc-plugins/raw/comm-filter-plugin/develop/built/comm-filter.meta.js
// @downloadURL    https://github.com/udnp/iitc-plugins/raw/comm-filter-plugin/develop/built/comm-filter.user.js
// @description    [udnp-2016-03-28-164226] COMM Filter
// @include        https://www.ingress.com/intel*
// @include        http://www.ingress.com/intel*
// @match          https://www.ingress.com/intel*
// @match          http://www.ingress.com/intel*
// @include        https://www.ingress.com/mission/*
// @include        http://www.ingress.com/mission/*
// @match          https://www.ingress.com/mission/*
// @match          http://www.ingress.com/mission/*
// @grant          none
// ==/UserScript==


function wrapper(plugin_info) {
// ensure plugin framework is there, even if iitc is not yet loaded
if(typeof window.plugin !== 'function') window.plugin = function() {};

//PLUGIN AUTHORS: writing a plugin outside of the IITC build environment? if so, delete these lines!!
//(leaving them in place might break the 'About IITC' page or break update checks)
plugin_info.buildName = 'udnp';
plugin_info.dateTimeVersion = '20160328.164226';
plugin_info.pluginId = 'comm-filter';
//END PLUGIN AUTHORS NOTE



// PLUGIN START ////////////////////////////////////////////////////////

// use own namespace for plugin
window.plugin.commfilter = (function() {
  var ID = 'PLUGIN_COMM_FILTER',
      DESCRIPTIONS = "COMM Filter plug-in",
      dom = null,
      comm = { //TODO change this to singleton
        dom: null,
        channels: {}, // all, faction, alerts
        
        Channel: function(name) {
          return {
            name: name,
            dom: null,
            hasLogs: function() {
              if(this.dom && this.dom.querySelector('table')) {
                return true;
              } else {
                return false;
              }
            }
          };
        },
        
        create: function() {
          var dom = document.getElementById('chat');
          if(!dom) return null;
          
          var channels = [new comm.Channel('all'), new comm.Channel('faction'), new comm.Channel('alerts')];
          
          for(var i = 0; i < channels.length; i++) {
            channels[i].dom = dom.querySelector('#chat' + channels[i].name);
            
            if(channels[i].dom) {
              comm.insertStatusViewTo(channels[i].dom);
            }
            
            comm.channels[channels[i].name] = channels[i];
          }
          
          comm.dom = dom;
          
          // filtering by agent name clicked/tapped in COMM       
          dom.addEventListener('click', function(event){
            if(!event.target.classList.contains('nickname')) return;
            
            // tentative: to avoid a problem on Android that causes cached chat logs reset,
            //            call event.stopImmediatePropagation() in this.
            //            So IITC default action that inputs @agentname automatically 
            //            to the #chattext box is blocked.
            //TODO related to issue#5
            event.stopImmediatePropagation();

            var channel = window.chat.getActive();
            
            if(comm.channels[channel].hasLogs()) {
              if(!inputAgent.value) {
                inputAgent.value = event.target.textContent;
              } else {
                inputAgent.value = inputAgent.value + ' ' + event.target.textContent;
              }

              inputAgent.fireInputEvent();
            }
          });
          
          // refreshing filtered logs on COMM tabs changed
          document.getElementById('chatcontrols').addEventListener('click', function(event) {
            if(comm.checkChannelTab(event.target)) {
              var channel = window.chat.getActive();
              if(comm.channels[channel].hasLogs()) renderLogs(channel);
            }
          });
          
          // tentatively to show 3 log lines on minimized
          if(window.useAndroidPanes()) {
            dom.classList.add('expand');
          }
          
          return comm;
        },
        
        insertStatusViewTo: function(channelDom) {
          var dom = document.createElement('div');
          dom.className = 'status';
          channelDom.insertBefore(dom, channelDom.firstChildElement);
        },
        
        checkChannelTab: function(tab) {
          if(tab.tagName.toLowerCase() === 'a' && tab.childElementCount === 0) return true;
          else return false;
        }
      },
      inputAgent,
      inputAction;
      
  var Input = (function Input() {
    var Input = function(prop) {
      var df = document.createDocumentFragment(),
          textbox = {
            dom: null,
            create: function(prop) {
              var dom = document.createElement('input');
              dom.type = 'text';
              dom.placeholder = prop.placeholder || '';

              this.dom = dom;
              return this;
            }
          },
          reset = {
            dom: null,
            create: function() {
              var dom = document.createElement('button');
              dom.type = 'button';
              dom.textContent = 'X';
              
              this.dom = dom;
              return this;
            }
          };
      
      textbox.create(prop);
      reset.create();
      reset.dom.addEventListener('click', this.clear.bind(this));
      
      df.appendChild(textbox.dom);
      df.appendChild(reset.dom);      

      Object.defineProperties(this, {
        name: {
          get: function name() {return textbox.dom ? textbox.dom.name : null;},
          set: function name(value) {if(textbox.dom) textbox.dom.name = value;}
        },
        value: {
          get: function value() {return textbox.dom ? textbox.dom.value : null;},
          set: function value(value) {if(textbox.dom) textbox.dom.value = value;},
        },
        defaultValue: {
          get: function defaultValue() {return textbox.dom ? textbox.dom.defaultValue : null;},
          set: function defaultValue(value) {if(textbox.dom) textbox.dom.defaultValue = value;},
        }
      });    

      this.dom = df;
      this.name = prop.name || '';
      this.defaultValue = '';
      this.value = this.defaultValue;
      this.oldValue = null;
      this.fireInputEvent = function() {
        if(textbox.dom) textbox.dom.dispatchEvent(new Event('input', {bubbles: true}));
      };      
    };
    
    Input.prototype = {
      constructor: Input,
      
      clear: function() {
        this.oldValue = this.value;
        this.value = this.defaultValue;
        this.fireInputEvent();
        
        //TODO related to issue#5
        //document.getElementById('chattext').value = '';
      },
      
      isChanged: function(){
        if(this.value !== this.oldValue){
          this.oldValue = this.value; 
          return true;
        }
        else return false;
      }      
    };
    
    return Input;
  })();

  function filterAgent(logRowDom) {
    if(!inputAgent.value) return;
    
    var agentDom = logRowDom.querySelector('.nickname'); 
    if(!agentDom) return;
    
    var agentsList = inputAgent.value.split(/\s+/);
    
    for(var i = 0; i < agentsList.length; i++) {
      if(agentsList[i]) {
        if(i > 0 && !logRowDom.hidden) return;
        
        if(checkWordPrefix(agentsList[i].toLowerCase(), agentDom.textContent.toLowerCase())) {
          logRowDom.hidden = false;
        } else {
          logRowDom.hidden = true;
        }
      }
    }
  }
  
  function filterAction(logRowDom) {
    if(!inputAction.value) return;
    if(logRowDom.cells.length !== 3) return;
    
    var actionDom = logRowDom.cells[2];
    var wordsList = inputAction.value.split(/\s+/);
    
    for(var i = 0; i < wordsList.length; i++) {
      if(wordsList[i]) {
        if(i > 0 && !logRowDom.hidden) return;
        
        if(checkWord(wordsList[i].toLowerCase(), actionDom.textContent.toLowerCase())) {
          logRowDom.hidden = false;
        } else {
          logRowDom.hidden = true;
        }
      }
    }
  }
  
  function filterOutAlert(logRowDom) {
    var alertDom = logRowDom.querySelector('.system_narrowcast');
    if(alertDom) logRowDom.hidden = true;
  }
  
  function resetFilter(logRowDom) {
    logRowDom.hidden = false;
  }
  
  function checkWord(prefix, word) {
    if(word.search(prefix) !== -1) return true;
    else return false;
  }
  
  function checkWordPrefix(prefix, word) {
    if(word.search(prefix) === 0) return true;
    else return false;
  }
  
  function renderLogs(channel) {
    switch(channel) {
      case 'all':
        window.chat.renderPublic(false);
        break;
        
      case 'faction':
        window.chat.renderFaction(false);
        break;
        
      case 'alerts':
        window.chat.renderAlerts(false);
        break;
        
      default:
        break;
    }
  }
  
  function setup() {
    if(!comm.create()) return;
        
    dom = document.createElement('header');
    dom.id = ID;
    
    var titleDom = document.createElement('b');
    titleDom.className = 'title';
    titleDom.textContent = 'Filter';
    titleDom.title = DESCRIPTIONS;
    dom.appendChild(titleDom);

    inputAgent = new Input({name: 'agent', placeholder: 'agent name'});
    dom.appendChild(inputAgent.dom);
    
    dom.addEventListener('input', function(event) {
      if(event.target.name === inputAgent.name) {
        var channel = window.chat.getActive();
        
        if(inputAgent.isChanged() && comm.channels[channel].hasLogs()) {
          renderLogs(channel);
        }
      }
    });
    
    var selectorAndOrDom = document.createElement('select');
    selectorAndOrDom.disabled = true;
    selectorAndOrDom.options[0] = document.createElement('option');
    selectorAndOrDom.options[0].textContent = 'AND';
    selectorAndOrDom.options[1] = document.createElement('option');
    selectorAndOrDom.options[1].textContent = 'OR';
    dom.appendChild(selectorAndOrDom);

    inputAction = new Input({name: 'action', placeholder: 'portal name'});
    dom.appendChild(inputAction.dom);
    
    dom.addEventListener('input', function(event) {
      if(event.target.name === inputAction.name) {
        var channel = window.chat.getActive();
        
        if(inputAction.isChanged() && comm.channels[channel].hasLogs()) {
          renderLogs(channel);
        }
      }
    });
    
    comm.dom.insertBefore(dom, comm.dom.firstElementChild);
    
    $("<style>")
      .prop("type", "text/css")
      .html("#PLUGIN_COMM_FILTER {\n  height: 24px;\n  display: flex;\n  align-items: center;\n}\n\n#PLUGIN_COMM_FILTER>.title {\n  padding: 0 0.5ex;\n}\n\n#PLUGIN_COMM_FILTER>select {\n  margin: 0 1ex;\n}\n\n#PLUGIN_COMM_FILTER>input {\n  height: 24px;\n}\n\n#PLUGIN_COMM_FILTER>input[name=agent] {\n  flex: 1;\n}\n\n#PLUGIN_COMM_FILTER>input[name=action] {\n  flex: 1.5;\n}\n\n#PLUGIN_COMM_FILTER>button {\n  padding: 2px;\n  min-width: 40px;\n  color: #FFCE00;\n  border: 1px solid #FFCE00;\n  background-color: rgba(8, 48, 78, 0.9);\n  text-align: center;\n}\n\n#chat {\n  padding-bottom: 24px;\n}\n\n#chatall>.status, #chatfaction>.status, #chatalerts>.status {\n  height: 20px;\n  text-align: center;\n  font-style: italic;\n}\n\n#chatall>table, #chatfaction>table, #chatalerts>table {\n  table-layout: auto;\n}\n\n#chatall>table td:nth-child(2),\n#chatfaction>table td:nth-child(2),\n#chatalerts>table td:nth-child(2) {\n  width: 15ex;\n}\n\n/* tentatively to show 3 log lines on minimized */\n#chat {\n  height: 84px; /* 60px + 24px */\n}\n\n/* tentatively to show 3 log lines on minimized */\n#chatcontrols {\n  bottom: 106px; /* 82px + 24px */\n}\n\n/* hack chat.js divider */\n#chatall>table tr.divider,\n#chatfaction>table tr.divider,\n#chatalerts>table tr.divider {\n  border-top: solid 1px #bbb;\n}\n\n#chatall>table tr.divider>td,\n#chatfaction>table tr.divider>td,\n#chatalerts>table tr.divider>td {\n  padding-top: 3px;\n}\n\n#chatall>table tr.divider summary,\n#chatfaction>table tr.divider summary,\n#chatalerts>table tr.divider summary {\n  box-sizing: border-box;\n  padding-left: 2ex;\n}\n")
      .appendTo("head");
  }

  return {
    filterAgent: filterAgent,
    filterAction: filterAction,
    filterOutAlert: filterOutAlert,
    resetFilter: resetFilter,
    setup: setup
  };

}());

var setup = function(){
  if(!window.chat) return; 
  
  // override and append functions following:
  
  //// based on original iitc/code/chat.js @ rev.5298c98
  // renders data from the data-hash to the element defined by the given
  // ID. Set 3rd argument to true if it is likely that old data has been
  // added. Latter is only required for scrolling.
  window.chat.renderData = function(data, element, likelyWereOldMsgs) {
    var elm = $('#'+element);
    if(elm.is(':hidden')) return;

    // discard guids and sort old to new
  //TODO? stable sort, to preserve server message ordering? or sort by GUID if timestamps equal?
    var vals = $.map(data, function(v, k) { return [v]; });
    vals = vals.sort(function(a, b) { return a[0]-b[0]; });

    // render to string with date separators inserted
    var msgs = '';
    var prevTime = null;
    $.each(vals, function(ind, msg) {
      var nextTime = new Date(msg[0]).toLocaleDateString();
      if(prevTime && prevTime !== nextTime)
        msgs += chat.renderDivider(nextTime);
      msgs += msg[2];
      prevTime = nextTime;
    });

    var scrollBefore = scrollBottom(elm);
    if(!window.plugin.commfilter) elm.html('<table>' + msgs + '</table>');    
    else elm.append(chat.renderTableDom($(msgs)));
    chat.keepScrollPosition(elm, scrollBefore, likelyWereOldMsgs);
  }

  //// based on original iitc/code/chat.js @ rev.5298c98
  // contains the logic to keep the correct scroll position.
  window.chat.keepScrollPosition = function(box, scrollBefore, isOldMsgs) {
    // If scrolled down completely, keep it that way so new messages can
    // be seen easily. If scrolled up, only need to fix scroll position
    // when old messages are added. New messages added at the bottom don’t
    // change the view and enabling this would make the chat scroll down
    // for every added message, even if the user wants to read old stuff.

    if(box.is(':hidden') && !isOldMsgs) {
      box.data('needsScrollTop', 99999999);
      return;
    }

    var logsTable = $('table', box);
    // box[0].offsetHeight - logsTable[0].offsetHeight
    var offset = box.outerHeight() - logsTable.outerHeight();

    if(offset > 0) {
      logsTable.css('margin-bottom', offset + 'px');
    }

    var statusView = $('.status', box); 
    statusView.text('');

    if(scrollBefore === 0 || isOldMsgs) {
      box.data('ignoreNextScroll', true);
      box.scrollTop(box.scrollTop() + (scrollBottom(box)-scrollBefore)
        + statusView.outerHeight());
      statusView.text('Now loading...');
    }
  }

  //// based on original iitc/code/chat.js @ rev.5298c98
  window.chat.renderDivider = function(text) {
    return '<tr class="divider"><td colspan="3"><summary>' + text + '</summary></td></tr>';
  }
  
  window.chat.renderTableDom = function(rowDoms) {
    var dF = document.createDocumentFragment();

    for(var i = 0; i < rowDoms.length; i++) {
      chat.filter(rowDoms[i]);
      dF.appendChild(rowDoms[i]);
    }
    
    var oldTableDom = document.querySelector('#chat' + window.chat.getActive() + ' table'); 
    if(oldTableDom) {
      oldTableDom.parentElement.removeChild(oldTableDom);
      oldTableDom = null;
    }
    
    var tableDom = document.createElement('table'); 
    tableDom.appendChild(dF);
    
    return tableDom;
  }

  window.chat.filter = function(rowDom) {
    if(!rowDom) return;
    if(!window.plugin.commfilter) return;

    window.plugin.commfilter.resetFilter(rowDom);
    window.plugin.commfilter.filterAgent(rowDom);
    
    // AND filtering
    if(!rowDom.hidden) window.plugin.commfilter.filterAction(rowDom);

    if(chat.getActive() === 'all') {
      window.plugin.commfilter.filterOutAlert(rowDom);
    }
  }

  window.plugin.commfilter.setup();
};

// PLUGIN END //////////////////////////////////////////////////////////


setup.info = plugin_info; //add the script info data to the function as a property
if(!window.bootPlugins) window.bootPlugins = [];
window.bootPlugins.push(setup);
// if IITC has already booted, immediately run the 'setup' function
if(window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);



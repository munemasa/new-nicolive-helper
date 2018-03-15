/*
 Copyright (c) 2017-2018 amano <amano@miku39.jp>

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 */
console.log( 'load background script.' );


browser.runtime.onInstalled.addListener( function(){
    browser.tabs.create( {
        url: "bg/verup.html",
        active: false
    } );
} );


let windowList = {};
let liveProp = {};

function OpenWindow( url, lvid ){
    let mainURL = browser.extension.getURL( url );
    let creating = browser.windows.create( {
        url: mainURL,
        type: "panel",
        width: 640,
        height: 480
    } );
    creating.then(
        ( windowInfo ) =>{
            console.log( `Created window: ${windowInfo.id}` );
            console.log( windowInfo );
            windowList[lvid] = windowInfo;
        },
        ( error ) =>{
            console.log( `create window Error: ${error}` );
        } );
}

function OpenNicoLiveHelperX2( request_id ){
    console.log( "Open New NicoLive Helper" );
    let lvid;
    if( request_id ){
        lvid = request_id[1];
    }else{
        lvid = 'lv0';
    }

    let url = "main/main.html";
    if( request_id ){
        url += "?lv=" + lvid;
    }

    if( windowList[lvid] ){
        let win_id = windowList[lvid].id;
        browser.windows.get( win_id, {populate: true} ).then(
            ( windowInfo ) =>{
                for( tabInfo of windowInfo.tabs ){
                    // console.log( tabInfo.url );
                    if( tabInfo.title.indexOf( 'New NicoLive Helper' ) >= 0 ){
                        console.log( `window ${win_id} is already exists.` );
                        browser.windows.update( win_id, {focused: true} );
                    }else{
                        OpenWindow( url, lvid );
                    }
                }
            },
            ( error ) =>{
                console.log( `get window error: ${error}` );
                OpenWindow( url, lvid );
            } );
    }else{
        OpenWindow( url, lvid );
    }
}


function putLiveinfo( request, sender, sendResponse ){
    // console.log( 'received live info.' );
    // console.log( sender );
    // console.log( request );

    let liveinfo = request.liveinfo;
    let lvid = liveinfo.program.nicoliveProgramId;

    liveProp["" + lvid] = liveinfo;
}

function getLiveInfo( request, sender, sendResponse ){
    console.log( sender );
    console.log( request );
    let lvid = request.request_id;
    let info = liveProp["" + lvid];
    // sendResponse( info );
    return new Promise( ( resolve ) =>{
        resolve( info );
    } );
}


function handleMessage( request, sender, sendResponse ){
    switch( request.cmd ){
    case 'put-liveinfo':
        putLiveinfo( request, sender, sendResponse );
        break;

    case 'get-liveinfo':
        return getLiveInfo( request, sender, sendResponse );
        break;
    }
}

browser.runtime.onMessage.addListener( handleMessage );

browser.browserAction.onClicked.addListener( ( tab ) =>{
    let request_id = tab.url.match( /nicovideo.jp\/watch\/((lv|co|ch)\d+)/ );
    OpenNicoLiveHelperX2( request_id );
} );

//browser.browserAction.setBadgeText( {text: 'NEW'} );


browser.contextMenus.onClicked.addListener( ( info, tab ) =>{
    console.log( "Item " + info.menuItemId + " clicked " + "in tab " + tab.id );
    let request_id = tab.url.match( /nicovideo.jp\/watch\/((lv|co|ch)\d+)/ );

    OpenNicoLiveHelperX2( request_id );
    // Notification("Start Live", "Starting a live lv9999999999");
} );

browser.contextMenus.create( {
    id: "menu_open_nicolivehelper_x",
    type: "normal",
    title: "Open New NicoLive Helper",
    contexts: ["all"]
} );


// chrome.devtools.network.onRequestFinished.addListener(
//     function( request ){
//         console.log( request );
//     } );

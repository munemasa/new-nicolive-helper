/*
 Copyright (c) 2017 amano <amano@miku39.jp>

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

let NicoLiveMylist = {
    mylists: [],            // マイリストグループ
    mylist_itemdata: {},    // 動画のマイリスト登録日とマイリストコメント

    getName: function( mylist_id ){
        for( let i = 0, item; item = this.mylists.mylistgroup[i]; i++ ){
            if( item.id == mylist_id ){
                return item.name;
            }
        }
        return undefined;
    },

    /**
     * とりマイに追加する(本処理)
     * @param video_id 動画ID
     * @param item_id
     * @param token
     * @param additional_msg マイリストコメント
     */
    addDeflistExec: function( video_id, item_id, token, additional_msg ){
        // 二段階目は取得したトークンを使ってマイリス登録をする.
        let f = function( xml, xmlhttp ){
            if( xmlhttp.readyState == 4 && xmlhttp.status == 200 ){
                let result = JSON.parse( xmlhttp.responseText );
                switch( result.status ){
                case 'ok':
                    NicoLiveHelper.showAlert( `${video_id}をとりあえずマイリストしました` );
                    break;
                case 'fail':
                    NicoLiveHelper.showAlert( result.error.description );
                    break;
                default:
                    break;
                }
            }
        };
        NicoApi.addDeflist( item_id, token, additional_msg, f );
    },

    /**
     * とりマイに登録する.
     * @param video_id 動画ID
     * @param additional_msg マイリストコメント
     */
    addDeflist: function( video_id, additional_msg ){
        // 一段階目はトークンを取得する.
        if( !video_id ) return;
        let f = function( xml, xmlhttp ){
            if( xmlhttp.readyState == 4 && xmlhttp.status == 200 ){
                try{
                    let token = xmlhttp.responseText.match( /NicoAPI\.token\s*=\s*\"(.*)\";/ );
                    if( !token ){
                        token = xmlhttp.responseText.match( /NicoAPI\.token\s*=\s*\'(.*)\';/ );
                    }
                    let item_id = xmlhttp.responseText.match( /item_id\"\s*value=\"(.*)\">/ );
                    token = token[1];
                    item_id = item_id[1];
                    NicoLiveMylist.addDeflistExec( video_id, item_id, token, additional_msg );
                }catch( x ){
                    console.log( x );
                    NicoLiveHelper.showAlert( 'とりあえずマイリスト追加に失敗しました' );
                }
            }
        };
        NicoApi.getMylistToken( video_id, f );
    },

    /**
     * マイリストに登録する(本処理)
     * @param item_id
     * @param mylist_id マイリストID
     * @param token
     * @param video_id 動画ID
     * @param additional_msg マイリストコメント
     */
    addMyListExec: function( item_id, mylist_id, token, video_id, additional_msg ){
        // 二段階目は取得したトークンを使ってマイリス登録をする.
        let f = function( xml, req ){
            if( req.readyState == 4 && req.status == 200 ){
                let result = JSON.parse( req.responseText );
                switch( result.status ){
                case 'ok':
                    NicoLiveHelper.showAlert( `${video_id}を「${NicoLiveMylist.getName( mylist_id )}」にマイリストしました` );
                    break;
                case 'fail':
                    NicoLiveHelper.showAlert( result.error.description );
                    break;
                default:
                    break;
                }
            }
        };
        NicoApi.addMylist( item_id, mylist_id, token, additional_msg, f );
    },

    /**
     * マイリストに追加する.
     * @param mylist_id マイリストID
     * @param video_id 動画ID
     * @param additional_msg 追加メッセージ
     */
    addMylist: function( mylist_id, video_id, additional_msg ){
        console.log( `Add mylist: ${mylist_id}, ${video_id}` );

        if( mylist_id == 'default' ){
            this.addDeflist( video_id, additional_msg );
        }else{
            // 一段階目はトークンを取得する.
            let f = function( xml, req ){
                if( req.readyState == 4 && req.status == 200 ){
                    try{
                        let token = req.responseText.match( /NicoAPI\.token\s*=\s*\"(.*)\";/ );
                        if( !token ){
                            token = req.responseText.match( /NicoAPI\.token\s*=\s*\'(.*)\';/ );
                        }
                        let item_id = req.responseText.match( /item_id\"\s*value=\"(.*)\">/ );
                        NicoLiveMylist.addMyListExec( item_id[1], mylist_id, token[1], video_id, additional_msg );
                    }catch( x ){
                        console.log( x );
                        NicoLiveHelper.showAlert( 'マイリスト追加に失敗しました' );
                    }
                }
            };
            NicoApi.getMylistToken( video_id, f );
        }
    },

    processMylistGroup: function(){
        // ストックのマイリストメニューに項目を追加
        let menu = $( '#menu-stock-mylist' );
        for( let i = 0, grp; grp = NicoLiveMylist.mylists.mylistgroup[i]; i++ ){
            let a = document.createElement( 'a' );
            a.setAttribute( 'class', 'dropdown-item' );
            a.setAttribute( 'href', '#' );
            a.setAttribute( 'nico_grp_id', grp.id );
            a.appendChild( document.createTextNode( grp.name ) );
            menu.append( a );
        }
    },

    loadMylist: function(){
        let f = function( xml, req ){
            if( req.readyState == 4 && req.status == 200 ){
                try{
                    NicoLiveMylist.mylists = JSON.parse( req.responseText );
                    NicoLiveMylist.processMylistGroup();
                }catch( x ){
                    if( NicoLiveMylist.mylists.status == 'fail' ){
                        NicoLiveHelper.showAlert( NicoLiveMylist.mylists.error.description );
                    }
                    return;
                }

                if( NicoLiveMylist.mylists.status == 'fail' ){
                    NicoLiveHelper.showAlert( NicoLiveMylist.mylists.error.description );
                    return;
                }
            }
        };
        NicoApi.getmylistgroup( f );
    },

    init: function(){
        this.loadMylist();
    },

    destroy: function(){

    }
};


window.addEventListener( "unload", ( ev ) =>{
    NicoLiveMylist.destroy();
} );


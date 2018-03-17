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

var UserManage = {

    createTable: function(){
        let users = this.collectUser();
        let table = $( '#tbl-user-management' );
        table.empty();

        for( let user of users ){
            let t = document.querySelector( '#template-um-user' );
            let clone2 = document.importNode( t.content, true );
            let elem = clone2.firstElementChild;

            let user_id = elem.querySelector( '.um-user_id' );
            let kotehan = elem.querySelector( '.um-kotehan' );
            let request_num = elem.querySelector( '.um-request_num' );
            let reflection_type = elem.querySelector( '.um-reflection_type' );
            let display_name = elem.querySelector( '.um-display_name' );

            $( user_id ).text( user );
            $( kotehan ).text( NicoLiveComment.namemap[user] && NicoLiveComment.namemap[user].name || '' );
            $( request_num ).text( `${NicoLiveRequest.counter[user] || 0}回` );
            $( reflection_type ).val( NicoLiveComment.reflectionmap[user] && NicoLiveComment.reflectionmap[user].type || 0 );
            $( reflection_type ).attr( 'user_id', user );
            $( display_name ).text( NicoLiveComment.reflectionmap[user] && NicoLiveComment.reflectionmap[user].name || '' );
            table.append( elem );
        }
    },

    collectUser: function(){
        let tmp = [];
        tmp = tmp.concat( Object.keys( NicoLiveRequest.counter ) );
        tmp = tmp.concat( Object.keys( NicoLiveComment.namemap ) );
        tmp = tmp.concat( Object.keys( NicoLiveComment.reflectionmap ) );
        let user_id = Array.from( new Set( tmp ) ).sort();
        return user_id;
    },

    init: function(){
        $( document ).on( 'change', '.um-reflection_type', async function( ev ){
            // リフレクション設定の変更
            let $this = $( this );
            let user_id = $this.attr( 'user_id' );
            let type = $this.val();
            if( type != 0 ){
                let defname = '★';
                if( user_id > 0 ){
                    defname = await NicoLiveComment.getProfileName( user_id, '★' );
                }
                let name = window.prompt( 'リフレクション時の表示名を入れてください', defname );
                if( name ){
                    NicoLiveComment.addReflection( user_id, name, type );
                }else{
                    $this.val( 0 );
                }
            }else{
                // リフレクションなし
                NicoLiveComment.removeReflection( user_id );
            }
        } );
    }
};

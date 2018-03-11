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


var NicoLiveRequest = {
    request: [],

    _queue: [],


    /**
     * リクエスト登録のキューを処理する.
     * @returns {Promise<void>}
     * @private
     */
    _runQueue: async function(){
        let q = this._queue[0];

        try{
            let vinfo = await NicoLiveHelper.getVideoInfo( q.video_id );
            vinfo.video_id = q.video_id;
            vinfo.is_self_request = q.is_self_request;
            vinfo.comment_no = q.comment_no;
            vinfo.request_user_id = q.user_id;
            vinfo.is_self_request = q.is_self_request;
            vinfo.rights_code = q.code;

            this.request.push( vinfo );
            let elem = NicoLiveHelper.createVideoInfoElement( vinfo );
            $( '#request-table-body' ).append( elem );

            this.updateBadgeAndTime();
        }catch( e ){
            // TODO 削除済み動画
        }

        this._queue.shift();
        if( this._queue.length > 0 ){
            this._runQueue();
        }

        clearTimeout( this._timer );
        this._timer = setTimeout( () =>{
            this.saveRequests();
        }, 1500 );
    },

    /**
     * リクエストの個数と総時間表示を更新する.
     */
    updateBadgeAndTime: function(){
        let n = this.request.length;
        $( '#number-of-requests' ).text( n );

        let t = NicoLiveHelper.calcTotalVideoTime( this.request );
        $( '#total-request-time' ).text( t.min + '分' + t.sec + '秒' );

        let tr = document.querySelectorAll( '#request-table tr' );
        t = 0;
        for( let i = 0, row; row = tr[i]; i++ ){
            let item = this.request[i];

            let elem = row.querySelector( '.nico-index' );
            $( elem ).text( `#${(i + 1)}` );

            elem = row.querySelector( '.nico-comment_no' );
            if( item.comment_no ){
                $( elem ).text( `C#${item.comment_no}` );
            }else{
                $( elem ).text( '' );
            }
            // 先頭から何分後にあるかの表示
            let timestr = GetTimeString( t );
            elem = row.querySelector( '.nico-timing' );
            $( elem ).text( `+${timestr}` );
            t += Config['videoinfo-interval'] + item.length_ms / 1000;

            let details = row.querySelector( '.nico-details' );
            details.setAttribute( 'id', `nico-details-${i}` );
            let btn = row.querySelector( '.btn-nico-details' );
            btn.setAttribute( 'data-target', `#nico-details-${i}` );
        }
    },


    /**
     * ストックに直接追加する.
     * @param vinfo
     */
    addRequestDirect: function( vinfo ){
        vinfo = JSON.parse( JSON.stringify( vinfo ) );

        this.request.push( vinfo );

        let elem = NicoLiveHelper.createVideoInfoElement( vinfo );
        $( '#request-table-body' ).append( elem );

        this.updateBadgeAndTime();
    },

    /**
     * リクエストの追加要求する.
     * @param video_id 動画ID
     * @param comment_no コメント番号
     * @param user_id リク主ID
     * @param is_self_request 自貼りフラグ
     * @param code JWID等コード
     */
    addRequest: function( video_id, comment_no, user_id, is_self_request, code ){
        let q = {
            'video_id': video_id,
            'comment_no': comment_no,
            'user_id': user_id,
            'is_self_request': is_self_request,
            'code': code
        };

        let n = this._queue.length;
        this._queue.push( q );
        if( n === 0 ){
            this._runQueue();
        }
    },


    /**
     * リクエストを追加する
     * @param video_id
     * @returns {Promise<void>}
     */
    addRequests: async function( video_id ){
        console.log( video_id );
        if( video_id.length < 3 ) return;
        let l = video_id.match( /(sm|nm|so)\d+|\d{10}/g );

        for( let i = 0, id; id = l[i]; i++ ){
            // TODO テスト用にコメント番号を付けているので不要になったら削除
            let cno = 0;//parseInt( Math.random() * 1000 );
            this.addRequest( id, cno, "0", false );
        }

        $( '#input-request-video' ).val( '' );
    },

    loadRequests: async function(){
        try{
            let result = await browser.storage.local.get( 'request' );
            console.log( result );
            if( !result.request ) return;

            for( let vinfo of result.request ){
                this.request.push( vinfo );
                let elem = NicoLiveHelper.createVideoInfoElement( vinfo );
                $( '#request-table-body' ).append( elem );
            }
            this.updateBadgeAndTime();
        }catch( e ){
            console.log( 'loading request have failed.' );
            console.log( e );
        }
    },

    /**
     * リクエストを保存する.
     * @returns {Promise<void>}
     */
    saveRequests: async function(){
        if( !NicoLiveHelper.isCaster() ) return;

        try{
            await browser.storage.local.set( {
                'request': this.request
            } );
            console.log( 'request saved.' );
        }catch( e ){
        }
    },

    /**
     * リクエストをシャッフルする.
     */
    shuffleRequests: function(){
        ShuffleArray( this.request );
        this.redrawRequests();
        this.saveRequests();
    },

    // コメ番順にソート.
    sortRequestByCommentNo: function(){
        // order:1だと昇順、order:-1だと降順.
        let order = 1;
        this.request.sort( function( a, b ){
            if( b.comment_no == undefined ) return -1;
            if( a.comment_no == undefined ) return 1;
            try{
                let a_cno = parseInt( ("" + a.comment_no).split( "," )[0] );
                let b_cno = parseInt( ("" + b.comment_no).split( "," )[0] );
                return (a_cno - b_cno) * order;
            }catch( x ){
                console.log( x );
                return 0;
            }
        } );

        this.redrawRequests();
        this.saveRequests();
    },

    /**
     * 重複リクエストを指定位置を起点に圧縮する.
     * @param idx
     */
    compactRequest: function( idx ){
        let newarray = [];
        let indexlist = {};
        let len = this.request.length;

        for( let i = idx; i < idx + len; i++ ){
            let n = i % len;
            let vinfo = this.request[n];
            if( indexlist["_" + vinfo.video_id] != undefined ){
                newarray[indexlist["_" + vinfo.video_id]].comment_no += ", " + vinfo.comment_no;
            }else{
                indexlist["_" + vinfo.video_id] = newarray.length;
                newarray.push( vinfo );
            }
        }
        this.request = newarray;
        this.saveRequests();
    },

    /**
     * リクエスト一覧表示を再作成する.
     */
    redrawRequests: function(){
        $( '#request-table-body' ).empty();
        for( let vinfo of this.request ){
            let elem = NicoLiveHelper.createVideoInfoElement( vinfo );
            $( '#request-table-body' ).append( elem );
        }
        this.updateBadgeAndTime();
    },


    moveUp: function( tr, index ){
        if( index <= 0 ) return;
        SwapArrayElements( this.request, index, index - 1 );

        let parent = tr.parentNode;
        let prev = tr.previousElementSibling;
        parent.insertBefore( tr, prev );

        this.updateBadgeAndTime();
        this.saveRequests();
    },

    moveDown: function( tr, index ){
        if( index >= this.request.length - 1 ) return;
        SwapArrayElements( this.request, index, index + 1 );

        let parent = tr.parentNode;
        if( index === this.request.length - 2 ){
            parent.appendChild( tr );
        }else{
            let next = tr.nextElementSibling.nextElementSibling;
            parent.insertBefore( tr, next );
        }

        this.updateBadgeAndTime();
        this.saveRequests();
    },

    moveTop: function( tr, index ){
        let q = this.request;
        let t;
        t = q.splice( index, 1 );
        if( t ){
            q.unshift( t[0] );
        }

        let parent = tr.parentNode;
        parent.insertBefore( tr, parent.firstChild );

        this.updateBadgeAndTime();
        this.saveRequests();
    },

    moveBottom: function( tr, index ){
        let q = this.request;
        let t;
        t = q.splice( index, 1 );
        if( t ){
            q.push( t[0] );
        }

        let parent = tr.parentNode;
        parent.appendChild( tr );

        this.updateBadgeAndTime();
        this.saveRequests();
    },

    removeRequest: function( tr, index ){
        let removeditem = this.request.splice( index, 1 );
        RemoveElement( tr );
        this.updateBadgeAndTime();
        this.saveRequests();
        return removeditem[0];
    },

    removeAllRequests: function(){
        this.request = [];
        $( '#request-table-body' ).empty();
        this.updateBadgeAndTime();
        this.saveRequests();
    },

    playVideo: async function( index ){
        let video = this.request[index];
        console.log( `${video.video_id} ${video.title}` );
        try{
            let ret = await NicoLiveHelper.playVideo( video );
            let removeditem = this.request.splice( index, 1 );
            this.redrawRequests();
            this.saveRequests();
        }catch( e ){
            if( e ){
                // 再生できない動画には生放送不可のマークを追加する
                let isPerm = false;
                let name = '';
                let mail = '';
                let text = `${video.video_id}: ${e.meta.errorMessage}`;
                NicoLiveHelper.postCasterComment( text, mail, name, isPerm );
                // TODO 引用できないのか、放送終了しているのか判断できない
                video.no_live_play = 1;
                this.redrawRequests();
            }
        }
    },

    onButtonClicked: function( ev ){
        let action = ev.target.getAttribute( 'function' );
        let tr = FindParentElement( ev.target, 'tr' );
        let index = tr.sectionRowIndex;

        switch( action ){
        case 'play':
            this.playVideo( index );
            break;

        case 'move_up':
            this.moveUp( tr, index );
            break;
        case 'move_down':
            this.moveDown( tr, index );
            break;

        case 'move_top':
            this.moveTop( tr, index );
            break;
        case 'move_bottom':
            this.moveBottom( tr, index );
            break;

        case 'remove':
            this.removeRequest( tr, index );
            break;

        default:
            break;
        }
    },

    contextMenu: function( key, options ){
        let elem = options.$trigger[0];
        let n = elem.sectionRowIndex;

        switch( key ){
        case 'copy':
            CopyToClipboard( this.request[n].video_id );
            break;

        case 'copy_all':
            let str = "";
            for( let i = 0, item; item = this.request[i]; i++ ){
                str += item.video_id + " ";
            }
            CopyToClipboard( str );
            break;

        case 'to_stock':
            // TODO ストックにコピーする
            NicoLiveStock.addStockDirect( this.request[n] );
            break;

        case 'compaction':
            this.compactRequest( n );
            this.redrawRequests();
            break;

        case 'profile':
            OpenLink( 'http://www.nicovideo.jp/user/' + this.request[n].user_id );
            break;

        default:
            // マイリスト追加処理
            console.log( key );
            console.log( options.$trigger );
            let mylist_id = key.match( /^\d+_(.*)/ )[1];
            let video_id = this.request[n].video_id;
            NicoLiveMylist.addMylist( mylist_id, video_id, '' );
            break;
        }
        // console.log( options.$trigger );
    },

    initUI: function(){
        $( document ).on( 'click', '#request-table-body .nico-video-row button', ( ev ) =>{
            this.onButtonClicked( ev );
        } );

        $( '#btn-shuffle-request' ).on( 'click', ( ev ) =>{
            this.shuffleRequests();
        } );

        $( '#menu-remove-all-requests' ).on( 'click', ( ev ) =>{
            this.removeAllRequests();
        } );

        $( '#menu-sort-by-comment-no' ).on( 'click', ( ev ) =>{
            this.sortRequestByCommentNo();
        } );

        $( '#btn-add-request' ).on( 'click', ( ev ) =>{
            let str = $( '#input-request-video' ).val();
            this.addRequests( str );
        } );

        $( '#input-request-video' ).on( 'keydown', ( ev ) =>{
            if( ev.keyCode === 13 ){
                let str = $( '#input-request-video' ).val();
                this.addRequests( str );
            }
        } );

        //---------- request-table-body
        $.contextMenu( {
            selector: '#request-table-body .nico-video-row',
            build: function( $triggerElement, e ){
                let menuobj = {
                    zIndex: 10,
                    callback: function( key, options ){
                        NicoLiveRequest.contextMenu( key, options );
                    },
                    items: {
                        "copy": {name: "動画IDをコピー"},
                        "to_stock": {name: "ストックにコピー"},
                        "add_mylist": {
                            name: "マイリストに追加",
                            items: {}
                        },
                        "sep1": "---------",
                        "copy_all": {name: "すべての動画IDをコピー"},
                        "compaction": {name: "コンパクション"},
                        "sep2": "---------",
                        "profile": {name: "投稿者プロフィール"},
                    }
                };
                try{
                    menuobj.items.add_mylist.items['0_default'] = {name: 'とりあえずマイリスト'};
                    for( let i = 0, item; item = NicoLiveMylist.mylists.mylistgroup[i]; i++ ){
                        let k = `${i + 1}_${item.id}`;
                        let v = item.name;
                        menuobj.items.add_mylist.items[k] = {name: v};
                    }
                }catch( x ){
                }
                return menuobj;
            }
        } );
    },

    init: async function(){
        this.initUI();
        this.loadRequests();
    }
};

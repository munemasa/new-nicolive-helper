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
            t += Config.play_interval + item.length_ms / 1000;

            let details = row.querySelector( '.nico-details' );
            details.setAttribute( 'id', `nico-details-${i}` );
            let btn = row.querySelector( '.btn-nico-details' );
            btn.setAttribute( 'data-target', `#nico-details-${i}` );
        }
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
            this.addRequest( id, 9999, "0", false );
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

    playVideo: function( tr, index ){
        // TODO 動画再生を実装する
        let video = this.request[index];
        console.log( `${video.video_id} ${video.title}` );
    },

    onButtonClicked: function( ev ){
        let action = ev.target.getAttribute( 'function' );
        let tr = FindParentElement( ev.target, 'tr' );
        let index = tr.sectionRowIndex;

        switch( action ){
        case 'play':
            this.playVideo( tr, index );
            break;

        case 'move_up':
            this.moveUp( tr, index );
            break;
        case 'move_down':
            this.moveDown( tr, index );
            break;

        case 'prepare':
            // TODO 先読みコマンドを送る
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

    initUI: function(){
        $( document ).on( 'click', '#request-table-body .nico-video-row button', ( ev ) =>{
            this.onButtonClicked( ev );
        } );

        $( '#btn-shuffle-request' ).on( 'click', ( ev ) =>{
            this.shuffleRequests();
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
    },

    init: async function(){
        this.initUI();
        this.loadRequests();
    }
};

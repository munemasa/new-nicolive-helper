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
            console.log( t );
            console.log( timestr );
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


    addRequests: async function( video_id ){
        console.log( video_id );
        if( video_id.length < 3 ) return;
        let l = video_id.match( /(sm|nm|so)\d+|\d{10}/g );

        for( let i = 0, id; id = l[i]; i++ ){
            this.addRequest( id, 9999, "0", false );
        }

        $( '#input-request-video' ).val( '' );
    },

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

    initUI: function(){
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
    }
};

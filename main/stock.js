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


var NicoLiveStock = {
    stock: [],

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

            if( !this.stock.find( ( s ) =>{
                    return s.video_id == q.video_id;
                } ) ){
                // 重複していないものだけ追加
                this.stock.push( vinfo );
                let elem = NicoLiveHelper.createVideoInfoElement( vinfo );
                $( '#stock-table-body' ).append( elem );
                this.updateBadgeAndTime();
            }
        }catch( e ){
            // TODO 削除済み動画
        }

        this._queue.shift();
        if( this._queue.length > 0 ){
            this._runQueue();
        }

        clearTimeout( this._timer );
        this._timer = setTimeout( () =>{
            this.saveStocks();
        }, 1500 );
    },

    /**
     * ストックの個数と総時間表示を更新する.
     */
    updateBadgeAndTime: function(){
        let n = 0;
        this.stock.forEach( function( item ){
            if( !item.is_played && !item.no_live_play ) n++;
        } );
        $( '#number-of-stocks' ).text( n );

        let t = this.getStockTime();
        $( '#total-stock-time' ).text( t.min + '分' + t.sec + '秒' );

        let tr = document.querySelectorAll( '#stock-table tr' );
        t = 0;
        for( let i = 0, row; row = tr[i]; i++ ){
            let item = this.stock[i];

            let elem = row.querySelector( '.nico-index' );
            $( elem ).text( `#${(i + 1)}` );

            elem = row.querySelector( '.nico-comment_no' );
            $( elem ).text( '' );

            // 先頭から何分後にあるかの表示
            let timestr = GetTimeString( t );
            elem = row.querySelector( '.nico-timing' );
            $( elem ).text( `+${timestr}` );
            t += Config['videoinfo-interval'] + item.length_ms / 1000;

            let details = row.querySelector( '.nico-details' );
            details.setAttribute( 'id', `nico-details-stk${i}` );
            let btn = row.querySelector( '.btn-nico-details' );
            btn.setAttribute( 'data-target', `#nico-details-stk${i}` );
        }
    },

    /**
     * ストックに直接追加する.
     * @param vinfo
     */
    addStockDirect: function( vinfo ){
        vinfo = JSON.parse( JSON.stringify( vinfo ) );

        this.stock.push( vinfo );

        let elem = NicoLiveHelper.createVideoInfoElement( vinfo );
        $( '#stock-table-body' ).append( elem );

        this.updateBadgeAndTime();
    },

    /**
     * リクエストの追加要求する.
     * @param video_id 動画ID
     */
    addStock: function( video_id ){
        let q = {
            'video_id': video_id
        };

        let n = this._queue.length;
        this._queue.push( q );
        if( n === 0 ){
            this._runQueue();
        }
    },


    /**
     * リクエストを複数追加する
     * @param video_id
     * @returns {Promise<void>}
     */
    addStocks: async function( video_id ){
        console.log( video_id );
        if( video_id.length < 3 ) return;
        let l = video_id.match( /(sm|nm|so)\d+|\d{10}/g );

        for( let i = 0, id; id = l[i]; i++ ){
            this.addStock( id );
        }

        $( '#input-stock-video' ).val( '' );
    },

    /**
     * とりあえずマイリストからストックに追加する.
     */
    addStockFromDeflist: function(){
        let f = function( xml, req ){
            if( req.readyState == 4 && req.status == 200 ){
                let result = JSON.parse( req.responseText );
                switch( result.status ){
                case 'ok':
                    let videos = new Array();
                    for( let i = 0; i < result.mylistitem.length; i++ ){
                        videos.push( result.mylistitem[i].item_data.video_id );
                    }
                    NicoLiveStock.addStocks( videos.join( ' ' ) );
                    break;
                case 'fail':
                    break;
                default:
                    break;
                }
            }
        };
        NicoApi.getDeflist( f );
    },

    /**
     * マイリストからストックに追加する.
     * @param mylist_id マイリストのID
     */
    addStockFromMylist: function( mylist_id ){
        if( mylist_id == 'deflist' ){
            this.addStockFromDeflist();
            return;
        }

        let f = function( xml, req ){
            if( req.readyState == 4 ){
                if( req.status == 200 ){
                    let xml = req.responseXML;
                    let items = xml.getElementsByTagName( 'item' );
                    let videos = new Array();
                    console.log( 'mylist rss items:' + items.length );
                    for( let i = 0, item; item = items[i]; i++ ){
                        let video_id;
                        let description;
                        try{
                            video_id = item.getElementsByTagName( 'link' )[0].textContent.match( /(sm|nm)\d+|\d{10}/ );
                        }catch( x ){
                            video_id = "";
                        }
                        if( video_id ){
                            videos.push( video_id[0] );
                            try{
                                description = item.getElementsByTagName( 'description' )[0].textContent;
                                description = description.replace( /[\r\n]/mg, '<br>' );
                                description = description.match( /<p class="nico-memo">(.*?)<\/p>/ )[1];
                            }catch( x ){
                                description = "";
                            }

                            let d = new Date( item.getElementsByTagName( 'pubDate' )[0].textContent );

                            let dat = {
                                "pubDate": d.getTime() / 1000,  // 登録日 UNIX time
                                "description": description
                            };
                            NicoLiveMylist.mylist_itemdata["_" + video_id[0]] = dat;
                        }
                    }// end for.
                    NicoLiveStock.addStocks( videos.join( ' ' ) );
                }else{
                    console.log( req );
                    NicoLiveMylist.addStockFromMylistViaApi( mylist_id );
                }
            }
        };
        NicoApi.mylistRSS( mylist_id, f );
    },

    /**
     * マイリストからストックに追加する(API使用).
     * @param mylist_id マイリストのID
     */
    addStockFromMylistViaApi: function( mylist_id ){
        let f = function( xml, req ){
            if( req.readyState == 4 ){
                if( req.status == 200 ){
                    let mylistobj = JSON.parse( req.responseText );
                    let videos = [];
                    console.log( mylistobj );
                    for( let item of mylistobj.mylistitem ){
                        videos.push( item.item_data.video_id ); // もしくは watch_id
                        let dat = {
                            "pubDate": item.create_time,  // 登録日 UNIX time
                            "description": item.description
                        };
                        NicoLiveMylist.mylist_itemdata["_" + item.item_data.video_id] = dat;
                    }
                    NicoLiveStock.addStocks( videos.join( ' ' ) );
                }
            }
        };

        // http://www.nicovideo.jp/my/mylist の token を得る
        let url = "http://www.nicovideo.jp/my/mylist";
        NicoApi.getApiToken( url, function( token ){
            NicoApi.getMylist( mylist_id, token, f );
        } );
    },

    loadStocks: async function(){
        try{
            let result = await browser.storage.local.get( 'stock' );
            console.log( result );
            if( !result.stock ) return;

            for( let vinfo of result.stock ){
                this.stock.push( vinfo );
                let elem = NicoLiveHelper.createVideoInfoElement( vinfo );
                $( '#stock-table-body' ).append( elem );
            }
            this.updateBadgeAndTime();
        }catch( e ){
            console.log( 'loading stock have failed.' );
            console.log( e );
        }
    },

    /**
     * リクエストを保存する.
     * @returns {Promise<void>}
     */
    saveStocks: async function(){
        if( !NicoLiveHelper.isCaster() ) return;

        try{
            await browser.storage.local.set( {
                'stock': this.stock
            } );
            console.log( 'stock saved.' );
        }catch( e ){
        }
    },

    /**
     * リクエストをシャッフルする.
     */
    shuffleStocks: function(){
        ShuffleArray( this.stock );
        this.redrawStocks();
        this.saveStocks();
    },

    /**
     * リクエスト一覧表示を再作成する.
     */
    redrawStocks: function(){
        $( '#stock-table-body' ).empty();
        for( let vinfo of this.stock ){
            let elem = NicoLiveHelper.createVideoInfoElement( vinfo );
            $( '#stock-table-body' ).append( elem );
        }
        this.updateBadgeAndTime();
    },

    sortStock: function( target, order ){
        let type = 0;
        switch( target ){
        case '#play':
            type = 0;
            break;
        case '#comment':
            type = 1;
            break;
        case '#mylist':
            type = 2;
            break;
        case '#length':
            type = 3;
            break;
        case '#date':
            type = 4;
            break;
        case '#mylistrate':
            type = 5;
            break;
        case '#title':
            type = 6;
            break;
        case '#bitrate':
            type = 9;
            break;

        default:
            return;
        }
        NicoLiveHelper.sortVideoList( this.stock, type, order );
        this.redrawStocks();
        this.saveStocks();
    },

    moveUp: function( tr, index ){
        if( index <= 0 ) return;
        SwapArrayElements( this.stock, index, index - 1 );

        let parent = tr.parentNode;
        let prev = tr.previousElementSibling;
        parent.insertBefore( tr, prev );

        this.updateBadgeAndTime();
        this.saveStocks();
    },

    moveDown: function( tr, index ){
        if( index >= this.stock.length - 1 ) return;
        SwapArrayElements( this.stock, index, index + 1 );

        let parent = tr.parentNode;
        if( index === this.stock.length - 2 ){
            parent.appendChild( tr );
        }else{
            let next = tr.nextElementSibling.nextElementSibling;
            parent.insertBefore( tr, next );
        }

        this.updateBadgeAndTime();
        this.saveStocks();
    },

    moveTop: function( tr, index ){
        let q = this.stock;
        let t;
        t = q.splice( index, 1 );
        if( t ){
            q.unshift( t[0] );
        }

        let parent = tr.parentNode;
        parent.insertBefore( tr, parent.firstChild );

        this.updateBadgeAndTime();
        this.saveStocks();
    },

    moveBottom: function( tr, index ){
        let q = this.stock;
        let t;
        t = q.splice( index, 1 );
        if( t ){
            q.push( t[0] );
        }

        let parent = tr.parentNode;
        parent.appendChild( tr );

        this.updateBadgeAndTime();
        this.saveStocks();
    },

    removeStock: function( tr, index ){
        let removeditem = this.stock.splice( index, 1 );
        RemoveElement( tr );
        this.updateBadgeAndTime();
        this.saveStocks();
        return removeditem[0];
    },

    removeAllStocks: function(){
        this.stock = [];
        $( '#stock-table-body' ).empty();
        this.updateBadgeAndTime();
        this.saveStocks();
    },

    /**
     * 再生済み動画を削除
     */
    removePlayedStock: function(){
        let newstock = this.stock.filter( ( s ) =>{
            return !s.is_played
        } );
        this.stock = newstock;
        this.redrawStocks();
        this.saveStocks();
    },

    /**
     * ストックを再生する.
     * @param index
     * @returns {Promise<boolean>}
     */
    playVideo: async function( index ){
        let video = this.stock[index];
        console.log( `${video.video_id} ${video.title}` );
        try{
            let ret = await NicoLiveHelper.playVideo( video );
            video.is_played = true;
            this.redrawStocks();
            this.saveStocks();
            return true;
        }catch( e ){
            // TODO エラーコードで区別できないので仕方なくテキスト内容で判断する
            if( e.meta.errorMessage.match( /引用再生できない動画/ ) ){
                video.no_live_play = 1;
                this.redrawStocks();
                this.saveStocks();
            }
            return false;
        }
    },

    getStockTime: function(){
        let length = 0;
        this.stock.forEach( ( item ) =>{
            if( !item.no_live_play && !item.is_played ){
                length += item.length_ms;
            }
        } );
        length = parseInt( length / 1000 );
        return {min: parseInt( length / 60 ), sec: length % 60};
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
            this.removeStock( tr, index );
            break;

        default:
            break;
        }
    },

    /**
     * ストックをファイルに保存する.
     */
    saveToFile: function(){
        let str = "";
        for( let i = 0, item; item = this.stock[i]; i++ ){
            str += item.video_id + "\t" + item.title + "\r\n";
        }
        SaveText( 'stock.txt', str );
    },

    /**
     * ストックのコンテキストメニューの実行.
     * @param key
     * @param options
     */
    contextMenu: function( key, options ){
        let elem = options.$trigger[0];
        let n = elem.sectionRowIndex;

        switch( key ){
        case'prepare':
            // TODO 先読みする
            break;

        case 'copy':
            CopyToClipboard( this.stock[n].video_id );
            break;

        case 'copy_all':
            let str = "";
            for( let i = 0, item; item = this.stock[i]; i++ ){
                str += item.video_id + " ";
            }
            CopyToClipboard( str );
            break;

        case 'to_request':
            NicoLiveRequest.addRequestDirect( this.stock[n] );
            break;

        case 'save_all':
            this.saveToFile();
            break;
        case 'profile':
            OpenLink( 'http://www.nicovideo.jp/user/' + this.stock[n].user_id );
            break;

        default:
            // マイリスト追加処
            console.log( key );
            console.log( options.$trigger );
            console.log( options );
            let mylist_id = key.match( /^\d+_(.*)/ )[1];
            let video_id = this.stock[n].video_id;
            NicoLiveMylist.addMylist( mylist_id, video_id, '' );
            break;
        }
        // console.log( options.$trigger );
    },

    dropToStock: function( ev ){
        ev = ev.originalEvent;
        if( ev.dataTransfer.types.includes( "text/uri-list" ) ){
            // <a>アンカータグをドロップしたときURLの動画IDをストックに追加する.
            let uri = ev.dataTransfer.mozGetDataAt( "text/uri-list", 0 );
            this.addStocks( uri );
            return;
        }
        if( ev.dataTransfer.types.includes( "text/plain" ) ){
            // テキストをドロップしたときURLの動画IDをストックに追加する.
            let uri = ev.dataTransfer.mozGetDataAt( "text/plain", 0 );
            this.addStocks( uri );
            return;
        }
        if( ev.dataTransfer.types.includes( "application/x-moz-file" ) ){
            // ファイルをドロップしたとき中身の動画IDをストックに追加する.
            let file = ev.dataTransfer.files[0];
            if( file.name.match( /\.txt$/ ) ){
                let fileReader = new FileReader();
                fileReader.onload = ( ev ) =>{
                    let txt = ev.target.result;
                    this.addStocks( txt );
                };
                fileReader.readAsText( file );
            }
            return;
        }
        if( ev.dataTransfer.types.includes( "application/x-moz-tabbrowser-tab" ) ){
            // WebExtensionsだとタブは取得できない.
            // TODO text/x-moz-text-internal でタブのURLは分かるので HTMLファイルを直接処理すればいける.
            let tab = ev.dataTransfer.mozGetDataAt( "application/x-moz-tabbrowser-tab", 0 );
            console.log( `Tab dropped: ${tab}` );
        }
    },

    initUI: function(){
        $( document ).on( 'click', '#stock-table-body .nico-video-row button', ( ev ) =>{
            this.onButtonClicked( ev );
        } );

        $( '#btn-shuffle-stock' ).on( 'click', ( ev ) =>{
            this.shuffleStocks();
        } );

        $( '#menu-remove-all-stock' ).on( 'click', ( ev ) =>{
            this.removeAllStocks();
        } );

        $( '#menu-remove-played' ).on( 'click', ( ev ) =>{
            this.removePlayedStock();
        } );

        //--- 並べ替えメニュー
        $( '#stock-sort-ascending-order a' ).on( 'click', ( ev ) =>{
            let target = $( ev.target ).attr( "href" );
            this.sortStock( target, 1 );
        } );
        $( '#stock-sort-descending-order a' ).on( 'click', ( ev ) =>{
            let target = $( ev.target ).attr( "href" );
            this.sortStock( target, -1 );
        } );

        $( '#btn-add-stock' ).on( 'click', ( ev ) =>{
            let str = $( '#input-stock-video' ).val();
            this.addStocks( str );
        } );

        $( '#input-stock-video' ).on( 'keydown', ( ev ) =>{
            if( ev.keyCode === 13 ){
                let str = $( '#input-stock-video' ).val();
                this.addStocks( str );
            }
        } );

        // ストックへのデータドロップによる追加処理
        $( '#stock-view' ).on( 'dragenter', ( ev ) =>{
            ev.preventDefault();
        } );
        $( '#stock-view' ).on( 'dragover', ( ev ) =>{
            ev.preventDefault();
        } );
        $( '#stock-view' ).on( 'drop', ( ev ) =>{
            console.log( ev );
            ev.preventDefault();

            this.dropToStock( ev );
        } );

        //--- マイリスト読み込み
        $( '#menu-stock-mylist' ).on( 'click', ( ev ) =>{
            let target = $( ev.target ).attr( "nico_grp_id" );
            if( target != undefined ){
                this.addStockFromMylist( target );
            }
        } );

        $.contextMenu( {
            selector: '#stock-table-body .nico-video-row',
            build: function( $triggerElement, e ){
                let menuobj = {
                    zIndex: 10,
                    callback: function( key, options ){
                        NicoLiveStock.contextMenu( key, options );
                    },
                    items: {
                        "copy": {name: "動画IDをコピー"},
                        "to_request": {name: "リクエストにコピー"},
                        "add_mylist": {
                            name: "マイリストに追加",
                            items: {}
                        },
                        "sep1": "---------",
                        "copy_all": {name: "すべての動画IDをコピー"},
                        "save_all": {name: "ストックをファイルに保存"},
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
            },
        } );
    },

    init: async function(){
        this.initUI();
        this.loadStocks();
    }
};

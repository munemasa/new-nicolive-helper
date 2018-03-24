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


var VideoDB = {
    search_result: [],

    initDB: async function(){
        let db = new Dexie( "NicoVideoDatabase" );
        db.version( 1 ).stores( {
            videodb: "&video_id,user_id,user_nickname,title,description,first_retrieve,length,view_counter,comment_num,mylist_counter,*tags_array,highbitrate,lowbitrate,movie_type,no_live_play"
        } );

        this.db = db;
        console.log( db );
    },

    /**
     * 検索条件を追加
     */
    addCondLine: function(){
        let t = document.querySelector( '#template-db-cond' );
        let clone2 = document.importNode( t.content, true );
        let elem = clone2.firstElementChild;
        $( '#db-condition' ).append( elem );
    },

    /**
     * 検索条件を削除
     * @param ev
     */
    removeCondLine: function( ev ){
        if( $( '.cond-line' ).length <= 1 ) return;
        RemoveElement( ev.target.parentNode );
    },

    addVideos: async function(){
        let str = $( '#input-video' ).val();
        if( str.length < 3 ) return;


        $( '#information' ).text( '動画を追加/更新しています...' );
        let l = str.match( /(sm|nm|so)\d+|\d{10}/g );

        for( let i = 0, id; id = l[i]; i++ ){
            try{
                let vinfo = await window.opener.NicoLiveHelper.getVideoInfo( id );
                this.db.videodb.put( vinfo );
                console.log( `${id}を追加しました` );
            }catch( e ){
            }
        }
        $( '#information' ).text( 'DB追加/更新完了しました' );
        $( '#input-video' ).val( '' );
    },

    test: async function(){
        let d = await this.db.videodb.get( 'sm9' );
        console.log( d );

        let r = await this.db.videodb.where( 'view_counter' ).above( 10000 ).toArray();
        console.log( r );
    },

    createListElement: function( item ){
        let t = document.querySelector( '#template-video-info' );
        let clone2 = document.importNode( t.content, true );
        let elem = clone2.firstElementChild;
        let image = elem.querySelector( '.video-thumbnail' );

        let posteddate = GetDateString( item.first_retrieve * 1000, true );

        if( item.deleted != 0 ){
            $( elem ).addClass( "video-deleted" );
        }
        image.setAttribute( 'src', item.thumbnail_url );
        image.setAttribute( 'style', 'width:65px;height:50px;margin-right:8px;' );
        let details = elem.querySelector( '.video-details' );

        let min = parseInt( item.length_ms / 1000 / 60 );
        let sec = parseInt( item.length_ms / 1000 % 60 );

        $( elem.querySelector( '.video-title' ) ).text( `${item.video_id} ${item.title}` );
        $( elem.querySelector( '.open-page' ) ).attr( 'href', `http://www.nicovideo.jp/watch/${item.video_id}` );

        details.appendChild( document.createTextNode( "投稿:" + posteddate + " 時間:" + (min + ":" + (sec < 10 ? ("0" + sec) : sec)) ) );
        details.appendChild( document.createElement( 'br' ) );
        details.appendChild( document.createTextNode( "再生:" + FormatCommas( item.view_counter )
            + " コメント:" + FormatCommas( item.comment_num )
            + " マイリスト:" + FormatCommas( item.mylist_counter ) ) );

        return elem;
    },


    searchVideos: async function(){
        let types = $( '.search-type' );
        let conds = $( '.search-cond' );
        let vals = $( '.search-value' );
        let n = types.length;

        let filter_func = [];
        for( let i = 0; i < n; i++ ){
            let t = $( types[i] ).val();
            let c = $( conds[i] ).val();
            let v = $( vals[i] ).val();
            if( t == 'length_ms' ){
                v *= 1000;
            }

            switch( c ){
            case 'include':
                filter_func.push( ( item ) =>{
                    let reg = new RegExp( v, 'i' );
                    if( t == 'tags_array' ){
                        for( let t of item.tags_array ){
                            if( t.match( reg ) ){
                                return true;
                            }
                        }
                        return false;
                    }else{
                        return item[t].match( reg );
                    }
                } );
                break;
            case 'exclude':
                filter_func.push( ( item ) =>{
                    let reg = new RegExp( v, 'i' );
                    if( t == 'tags_array' ){
                        for( let t of item.tags_array ){
                            if( t.match( reg ) ){
                                return false;
                            }
                        }
                        return true;
                    }else{
                        return !item[t].match( reg );
                    }
                } );
                break;
            case 'greater_than':
                filter_func.push( ( item ) =>{
                    return item[t] > v;
                } );
                break;
            case 'less_than':
                filter_func.push( ( item ) =>{
                    return item[t] < v;
                } );
                break;
            case 'equal':
            default:
                filter_func.push( ( item ) =>{
                    return item[t] == v;
                } );
                break;
            }
        }

        let limit = $( '#display-num' ).val() * 1;
        let result = await this.db.videodb.filter( ( item ) =>{
            for( let f of filter_func ){
                let flg = f( item );
                if( !flg ) return false;
            }
            return true;
        } ).toArray();

        let sorttype = $( '#sort-type' ).val() * 1;
        let order = $( '#sort-order' ).val() * 1;
        if( order != 0 ){
            window.opener.NicoLiveHelper.sortVideoList( result, sorttype, order );
        }else{
            ShuffleArray( result );
        }

        result = result.slice( 0, limit )
        console.log( result );
        $( '#information' ).text( `${result.length}件見つかりました。` );

        $( '#tbl-result' ).empty();
        for( let vinfo of result ){
            let elem = this.createListElement( vinfo );
            $( '#tbl-result' ).append( elem );
        }
        this.search_result = result;
    },

    copyToClipboard: function( type ){
        let items = $( '.item_selected' );
        let str = "";

        let videos = this.search_result;
        for( let i = 0; i < items.length; i++ ){
            let ind = items[i].rowIndex;
            switch( type ){
            case 0:
                // 動画ID
                str += videos[ind].video_id + "\n";
                break;
            case 1:
                // タイトル
                str += videos[ind].title + "\n";
                break;
            case 2:
                // 動画ID+タイトル
                str += videos[ind].video_id + "\t" + videos[ind].title + "\n";
                break;
            }
        }
        CopyToClipboard( str );
    },

    /**
     * ファイルに保存する
     */
    saveToFile: function(){
        let videos = this.search_result;

        let str = "";
        for( let i = 0; i < videos.length; i++ ){
            str += videos[i].video_id + "\t" + videos[i].title + "\r\n";
        }

        SaveText( 'videodb.txt', str );
    },

    /**
     * ストックに追加する
     */
    addToStock: function(){
        let items = $( '.item_selected' );
        let str = "";
        let videos = this.search_result;
        for( let i = 0; i < items.length; i++ ){
            let ind = items[i].rowIndex;
            str += videos[ind].video_id + " ";
        }
        window.opener.NicoLiveStock.addStocks( str );
    },

    /**
     * チェックした動画を削除する.
     */
    delete: function(){
        if( !window.confirm( "選択した動画を動画DBから削除しますか?" ) ) return;

        let items = $( '.item_selected' );
        let videos = this.search_result;
        let ids = [];
        for( let i = 0; i < items.length; i++ ){
            let ind = items[i].rowIndex;
            let video_id = videos[ind].video_id;
            ids.push( video_id );
        }
        this.db.videodb.bulkDelete( ids );
    },


    /**
     * コンテキストメニューの実行.
     * @param key
     * @param options
     */
    contextMenu: function( key, options ){
        let elem = options.$trigger[0];
        let n = elem.sectionRowIndex;
        console.log( key );

        switch( key ){
        case 'copy_vid':
            this.copyToClipboard( 0 );
            break;
        case 'copy_title':
            this.copyToClipboard( 1 );
            break;
        case 'copy_vid_title':
            this.copyToClipboard( 2 );
            break;

        case 'save':
            this.saveToFile();
            break;

        case 'stock':
            this.addToStock();
            break;

        case 'delete':
            this.delete();
            break;

        default:
            break;
        }
        // console.log( options.$trigger );
    },


    init: async function(){
        console.log( 'Video database init.' );

        this.initDB();

        let n = await this.db.videodb.count();
        $( '#information' ).text( `動画DBには${n}件あります` );

        $( document ).on( 'click', '#tbl-result tr', ( ev ) =>{
            let tr = FindParentElement( ev.target, 'tr' );

            if( ev.originalEvent.metaKey || ev.originalEvent.ctrlKey ){
                // 複数選択
                if( $( tr ).hasClass( 'item_selected' ) ){
                    $( tr ).removeClass( 'item_selected' );
                }else{
                    $( tr ).addClass( 'item_selected' );
                    this._index = tr.rowIndex;
                }
            }else if( ev.originalEvent.shiftKey ){
                let rows = $( '#tbl-result tr' );
                let start = Math.min( this._index, tr.rowIndex );
                let end = Math.max( this._index, tr.rowIndex );
                for( let i = start; i <= end; i++ ){
                    $( rows[i] ).addClass( 'item_selected' );
                }
            }else{
                // 1個選択
                $( '#tbl-result tr' ).removeClass( 'item_selected' );
                $( tr ).addClass( 'item_selected' );
                this._index = tr.rowIndex;
            }

            $( '#information' ).text( `選択: ${$( '.item_selected' ).length}` );
        } );

        $.contextMenu( {
            selector: '.nico-video-row',
            build: function( $triggerElement, e ){
                let menuobj = {
                    zIndex: 10,
                    callback: function( key, options ){
                        VideoDB.contextMenu( key, options );
                    },
                    items: {
                        "copy": {
                            name: "選択した動画をコピー",
                            items: {
                                "copy_vid": {name: "動画ID"},
                                "copy_title": {name: "タイトル"},
                                "copy_vid_title": {name: "動画ID＋タイトル"},
                            }
                        },
                        "stock": {name: "選択した動画をストックに追加"},

                        "sep1": "---------",
                        "delete": {name: "選択した動画を削除"},
                        "sep2": "---------",
                        "save": {name: 'ファイルに保存'}
                    }
                };
                return menuobj;
            },
        } );

        $( '#btn-add-db' ).on( 'click', ( ev ) =>{
            this.addVideos();
        } );
        $( '#btn-search' ).on( 'click', ( ev ) =>{
            this.searchVideos();
        } );

        this.addCondLine();
        $( document ).on( 'click', '.btn-add-cond', ( ev ) =>{
            this.addCondLine();
        } );
        $( document ).on( 'click', '.btn-remove-cond', ( ev ) =>{
            this.removeCondLine( ev );
        } );

        $( '#btn-test' ).on( 'click', ( ev ) =>{
            this.test();
        } );
    }
};


window.addEventListener( 'load', ( ev ) =>{
    VideoDB.init();
} );
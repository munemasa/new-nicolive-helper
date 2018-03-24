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

    initDB: async function(){
        let db = new Dexie( "NicoVideoDatabase" );
        db.version( 1 ).stores( {
            videodb: "&video_id,user_id,user_nickname,title,description,first_retrieve,length,view_counter,comment_num,mylist_counter,*tags_array,highbitrate,lowbitrate,movie_type,no_live_play"
        } );

        this.db = db;
        console.log( db );

        let vinfo = await window.opener.NicoLiveHelper.getVideoInfo( 'sm9' );
        console.log( vinfo );

        db.videodb.put( vinfo );
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
        let result = await this.db.videodb.filter( ( item ) =>{
            for( let f of filter_func ){
                let flg = f( item );
                if( !flg ) return false;
            }
            return true;
        } ).toArray();

        console.log( result );
        $( '#information' ).text( `${result.length}件見つかりました。` );

        $( '#tbl-result' ).empty();
        for( let vinfo of result ){
            let elem = this.createListElement( vinfo );
            $( '#tbl-result' ).append( elem );
        }
        return result;
    },

    init: async function(){
        console.log( 'Video database init.' );

        this.initDB();

        let n = await this.db.videodb.count();
        $( '#information' ).text( `動画DBには${n}件あります` );

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
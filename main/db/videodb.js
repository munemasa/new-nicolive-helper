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

    test: async function(){
        let d = await this.db.videodb.get( 'sm9' );
        console.log( d );

        let r = await this.db.videodb.where( 'view_counter' ).above( 10000 ).toArray();
        console.log( r );
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

    init: function(){
        console.log( 'Video database init.' );

        this.initDB();

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
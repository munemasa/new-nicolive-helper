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

var NicoLiveHistory = {
    history: [],

    addHistory: function( vinfo ){
        let hist = $( '#txt-play-history' );
        let text = hist.val();
        let str = vinfo.video_id + "\t" + vinfo.title + "\n";
        hist.val( text + str );

        this.history.push( vinfo );

        this.save();
    },

    /**
     * 再生履歴テキストに任意のテキストを追加する。
     * @param text
     */
    addHistoryText: function( text ){
        let hist = $( '#txt-play-history' );
        let history = hist.val();
        history += text;
        hist.val( history );

        this.save();
    },

    save: function(){
        let str = $( '#txt-play-history' ).val();
        browser.storage.local.set( {
            'history': str
        } );
    },
    init: async function(){
        let obj = await browser.storage.local.get( 'history' );
        $( '#txt-play-history' ).val( obj.history );

        $( '#txt-play-history' ).on( 'change', ( ev ) =>{
            this.save();
        } );

        // 再生履歴から動画IDのみをコピーする
        $( '#copy-history-text' ).on( 'click', ( ev ) =>{
            let substring;
            let notes = $( '#txt-play-history' )[0];
            substring = notes.value.substr( notes.selectionStart, notes.selectionEnd - notes.selectionStart );

            if( substring.length >= 3 ){
                let video_ids = substring.match( /^(sm|nm|ze|so)\d+|\d{10}/mg );
                if( video_ids ){
                    CopyToClipboard( video_ids.join( ' ' ) );
                }
            }
        } );

    }
};


window.addEventListener( 'load', ( ev ) =>{
    NicoLiveHistory.init();
} );
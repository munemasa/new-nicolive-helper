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

    addRequest: function( video_info ){
        this.request.push( video_info );
    },

    addRequests: async function( video_id ){
        console.log( video_id );
        if( text.length < 3 ) return;
        let l = text.match( /(sm|nm|so)\d+|\d{10}/g );

        for( let i = 0, id; id = l[i]; i++ ){
            let info = await NicoLiveHelper.getVideoInfo( id );
            this.addRequest( info );
        }

        $( '#input-request-video' ).val( '' );
    },

    initUI: function(){
        $( '#btn-add-request' ).on( 'click', ( ev ) =>{
            let str = $( '#input-request-video' ).val();
            this.addRequests( str );
        } );

        $( '#input-request-video' ).on( 'keydown', ( ev ) =>{
            if( ev.keyCode == 13 ){
                let str = $( '#input-request-video' ).val();
                this.addRequests( str );
            }
        } );

    },

    init: async function(){
        this.initUI();
    }
};

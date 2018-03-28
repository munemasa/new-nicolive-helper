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

var ContinuousComment = {

    sendLine: function(){
        var str;
        str = document.getElementById( 'multiline-comment' ).value.split( /\n|\r|\r\n/ );
        if( str.length ){
            let cmd = document.getElementById( 'multiline-command' ).value;
            let comment = str[0];
            if( !document.getElementById( 'use-bsp' ).checked ){
                comment = comment.replace( /\\([\\n])/g, function( s, p ){
                    switch( p ){
                    case "n":
                        return "\n";
                    case "\\":
                        return "\\";
                    default:
                        return s;
                    }
                } );
                if( comment.indexOf( "/" ) == 0 ){
                    let tmp = comment.split( "/" );
                    cmd += " " + tmp[1];
                    tmp.splice( 0, 2 );
                    comment = tmp.join( "/" );
                }
                opener.NicoLiveComment.sendCommentCore( comment, cmd );
            }else{
                let color = $( '#bsp-name-color' ).val();
                opener.NicoLiveHelper.postBSPComment( color, comment, cmd );
            }
            str.splice( 0, 1 );
            document.getElementById( 'multiline-comment' ).value = str.join( '\r\n' );
        }else{
        }
    },

    init: function(){
        document.title = `連続コメント ${window.opener.NicoLiveHelper.getLiveId()}`;

        $( '#btn-cc-send' ).on( 'click', ( ev ) =>{
            this.sendLine();
        } );
    }
};


$( window ).on( 'load', ( ev ) =>{
    ContinuousComment.init();
} );

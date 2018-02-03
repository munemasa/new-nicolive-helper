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

var WindowManage = {

    onResize: function(){
        let tab_content = $( '.tab-content' );
        let positionY = $( window ).outerHeight() - $( 'footer' ).outerHeight();
        let rect = tab_content[0].getBoundingClientRect();
        let y = rect.top + window.pageYOffset;
        let h = positionY - y;
        tab_content.outerHeight( h );
    }
};

window.addEventListener( 'resize', ( ev ) =>{
    WindowManage.onResize();
} );


window.addEventListener( 'load', ( ev ) =>{
    WindowManage.onResize();

    let tmp = localStorage.getItem( 'window_position' );
    if( tmp ){
        // TODO ウィンドウ位置とサイズを復元
        let window_position = JSON.parse( tmp );
    }

    let active_tab = localStorage.getItem( 'active_tab' ) || '#tab-request';
    console.log( `Active tab: ${active_tab}` );
    $( `header a[href="${active_tab}"]` ).tab( 'show' );

    // アクティブタブを設定
    $( `a[data-toggle="tab"][href="${active_tab}"]` ).addClass( 'active' );
} );

window.addEventListener( 'unload', ( ev ) =>{
    // アクティブタブを保存
    let target = $( 'a[data-toggle="tab"].active' ).attr( "href" );
    localStorage.setItem( 'active_tab', target );

    // ウィンドウ位置とサイズを保存
    let x = window.screenX;
    let y = window.screenY;
    let w = window.outerWidth;
    let h = window.outerHeight;
    let window_position = {
        x: x,
        y: y,
        w: w,
        h: h
    };
    localStorage.setItem( 'window_position', JSON.stringify( window_position ) );
} );

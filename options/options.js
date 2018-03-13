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


function LoadValue( key, config, defvalue ){
    if( config[key] != undefined ){
        document.querySelector( `#${key}` ).value = config[key];
    }else{
        document.querySelector( `#${key}` ).value = defvalue;
    }
}

function LoadBool( key, config, defvalue ){
    document.querySelector( `#${key}` ).checked = config[key] || defvalue;
}

function SaveValue( key, config ){
    config[key] = document.querySelector( `#${key}` ).value;
}

function SaveInt( key, config ){
    config[key] = parseInt( document.querySelector( `#${key}` ).value );
}

function SaveBool( key, config, value ){
    config[key] = document.querySelector( `#${key}` ).checked;
}


let g_vinfokey = [
    "vinfo-command-1",
    "vinfo-comment-1",
    "vinfo-command-2",
    "vinfo-comment-2",
    "vinfo-command-3",
    "vinfo-comment-3",
    "vinfo-command-4",
    "vinfo-comment-4"
];

let g_vinfo_defvalue = [
    '',
    '♪時間:{length} 再生数:{view} コメント:{comment} マイリスト:{mylist}',
    '',
    '♪{id} {title} 投稿日:{date}',
    '',
    '',
    '',
    ''
];


async function LoadOptions(){
    let result = await browser.storage.local.get( 'config' );
    console.log( result );

    let config = result.config || {};

    /* 進行 */
    LoadValue( 'autoplay-interval', config, 10 );

    /* コメント */
    LoadBool( 'comment-184', config, false );
    LoadBool( 'auto-kotehan', config, false );
    LoadValue( 'comment-dispay-lines', config, 500 );
    LoadValue( 'comment-backlog-num', config, 50 );

    /* 動画情報 */
    LoadValue( 'videoinfo-interval', config, 7 );
    let i = 0;
    for( let k of g_vinfokey ){
        LoadValue( k, config, g_vinfo_defvalue[i] );
        i++;
    }

}

function SaveOptions( ev ){
    ev.preventDefault();
    console.log( 'save settings' );

    let config = {};

    /* 進行 */
    SaveInt( 'autoplay-interval', config );

    /* コメント */
    SaveBool( 'comment-184', config );
    SaveBool( 'auto-kotehan', config );
    SaveInt( 'comment-dispay-lines', config );
    SaveInt( 'comment-backlog-num', config );

    /* 動画情報 */
    SaveInt( 'videoinfo-interval', config );
    for( let k of g_vinfokey ){
        SaveValue( k, config );
    }

    browser.storage.local.set( {
        'config': config
    } );
}

window.addEventListener( 'load', function( ev ){
    LoadOptions();

    document.querySelector( "#btn-save-config" ).addEventListener( "click", function( ev ){
        SaveOptions( ev );
    } );
} );

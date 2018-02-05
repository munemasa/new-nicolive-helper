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

var NicoLiveComment = {
    table: null,

    commentlog: [],    // コメントのログ(受信したもの全て記録)
    colormap: {},      // 配色マップ
    namemap: {},       // コテハンマップ

    _namecache: {},

    saveFile: function(){
        let str = "";
        for( let item, i = 0; item = this.commentlog[i]; i++ ){
            let datestr = GetDateString( item.date * 1000, true );
            str += item.no + '\t' + item.user_id + '\t' + item.text + '\t' + datestr + "\r\n";
        }
        let name = `${NicoLiveHelper.liveProp.program.nicoliveProgramId}.txt`;
        SaveText( name, str );
    },

    /**
     * 指定のユーザーIDのコテハンを返す.
     * コテハン設定がなければ空文字を返す.
     * @param user_id
     * @returns {*|string}
     */
    getKotehan: function( user_id ){
        return this.namemap[user_id] && this.namemap[user_id].name || "";
    },

    /**
     * コテハンを設定する。
     * @param user_id
     * @param name
     */
    setKotehan: function( user_id, name ){
        if( !name ) name = user_id;

        if( name != user_id ){
            this.namemap[user_id] = {
                "name": name
            };
        }else{
            delete this.namemap[user_id];
        }
        console.log( `Kotehan(${user_id})=${name}` );

        $( `span[user_id="${user_id}"]` ).text( name );
    },

    /**
     * プロフィールから名前を取得
     * @param user_id ユーザーID
     * @param defname
     * @param postfunc
     */
    // http://www.nicovideo.jp/user/... から登録(サムネから取れない時)
    getProfileName2: function( user_id, defname ){
        let p = new Promise( ( resolve, reject ) =>{
            let req = new XMLHttpRequest();
            if( !req ){
                resolve( defname );
                return;
            }
            req.onreadystatechange = function(){
                if( req.readyState == 4 ){
                    if( req.status == 200 ){
                        try{
                            let text = req.responseText;
                            let name = text.match( /<h2><strong>(.*)<\/strong>/ )[1];
                            if( name ){
                                // 名前の取得に成功
                                resolve( name );
                            }
                        }catch( x ){
                            resolve( defname );
                        }
                    }else{
                        resolve( defname );
                    }
                }
            };
            req.open( 'GET', 'http://www.nicovideo.jp/user/' + user_id );
            req.send( "" );

        } );
        return p;
    },

    /**
     * プロフィールの名前を取得.
     * @param user_id ユーザーID
     * @param defname デフォルト名
     */
    // http:/ext.nicovideo.jp/thumb_user/... から登録(こちら優先)
    getProfileName: function( user_id, defname ){
        let p = new Promise( ( resolve, reject ) =>{
            let req = new XMLHttpRequest();
            if( !req ){
                reject( '[Unknown]' );
                return;
            }
            req.onreadystatechange = function(){
                if( req.readyState == 4 ){
                    if( req.status == 200 ){
                        try{
                            let text = req.responseText;
                            let name = text.match( /><strong>(.*)<\/strong>/ )[1];
                            if( name ){
                                // 成功
                                resolve( name );
                            }else{
                                reject( '[Unknown]' )
                            }
                        }catch( x ){
                            reject( '[Unknown]' )
                        }
                    }else{
                        reject( '[Unknown]' )
                    }
                }
            };
            req.open( 'GET', 'http://ext.nicovideo.jp/thumb_user/' + user_id );
            req.send( "" );
        } );
        return p;
    },

    /**
     * 自動コテハン登録
     */
    autoKotehan: async function( chat ){
        if( !Config.comment.autokotehan ) return;
        if( chat.premium == 2 || chat.premium == 3 ) return;
        if( chat.date < NicoLiveHelper.connecttime ) return; // 過去ログ無視.

        let current_kotehan = this.getKotehan( chat.user_id );
        if( current_kotehan ) return;

        // ＠コテハン
        let dat = chat.text.match( /[@＠]([^0-9０-９\s@＠][^\s@＠]*?)$/ );
        if( dat ){
            let name = dat[1];
            if( name == "初見" || name == "確認" || name == "アンケート" ||
                name == "削除" || name == "代理" ) return;
            if( name == "○" || name == "×" || name == "△" ||
                name == "□" || name == "◎" ) return;
            this.setKotehan( chat.user_id, name );
            return;
        }

        if( chat.user_id.match( /^\d+$/ ) ){
            // ユーザIDからプロフィール参照登録.
            let name;
            try{
                name = await this.getProfileName( chat.user_id, chat.user_id );
            }catch( e ){
                name = await this.getProfileName2( chat.user_id, chat.user_id );
            }
            this.setKotehan( chat.user_id, name );
        }
    },

    /**
     * コメント表示欄にコメントを追加する.
     * @param comment
     */
    addComment: function( comment ){
        let table = this.table;
        if( !table ){
            return;
        }

        this.commentlog.push( comment );

        // 表示行数に切り詰め
        if( table.rows.length >= Config.comment.display_lines ){
            table.deleteRow( table.rows.length - 1 );
        }

        let tr = table.insertRow( 0 );
        tr.setAttribute( "tr_comment_by", comment.user_id );

        // NGスコアによる透過
        if( comment.score <= -10000 ){
            // なし
            tr.setAttribute( "style", "color: #00000030;" );
        }else if( comment.score <= -4800 ){
            // 弱
            tr.setAttribute( "style", "color: #00000060;" );
        }else if( comment.score <= -1000 ){
            // 中
            tr.setAttribute( "style", "color: #00000090;" );
        }else if( comment.score < 0 ){
            // 強
            tr.setAttribute( "style", "color: #000000c0;" );
        }

        //----- 背景色の決定
        if( !this.colormap[comment.user_id] ){
            let sel = GetRandomInt( 1, 8 );
            let col = 'color' + sel;
            tr.className = col;
            this.colormap[comment.user_id] = {"color": col, "date": GetCurrentTime()};
        }else{
            let col = this.colormap[comment.user_id].color;
            if( col.indexOf( 'color' ) == 0 ){
                tr.className = col;
            }else{
                tr.style.backgroundColor = col;
            }
        }
        if( comment.premium == 2 || comment.premium == 3 ){
            tr.className = "color_caster";
        }

        let td;
        //----- コメント番号のセル
        td = tr.insertCell( tr.cells.length );
        td.textContent = comment.no;

        //----- 名前表示のセル
        td = tr.insertCell( tr.cells.length );
        if( comment.yourpost ){
            // 自分のコメントは名前を強調する
            $( td ).addClass( 'nico_yourpost' );
        }

        let str;
        // コメントにname属性があればその名前を使用する.コテハンより優先される.
        str = comment.name || this.namemap[comment.user_id] && this.namemap[comment.user_id].name || comment.user_id;
        str = htmlspecialchars( str );

        let span = document.createElement( 'span' );
        span.setAttribute( 'comment_by', comment.user_id );
        span.setAttribute( 'user_id', comment.user_id );
        span.setAttribute( 'comment_no', comment.no );
        span.setAttribute( 'class', 'comment_username' );
        span.setAttribute( 'title', str );
        span.appendChild( document.createTextNode( str ) );
        td.appendChild( span );

        //----- コメントボディのセル
        td = tr.insertCell( tr.cells.length );
        td.setAttribute( 'style', 'width:100%;' );
        str = comment.text_notag;
        str = htmlspecialchars( str );
        let tmp = str.split( /(sm\d+|nm\d+|\d{10}|&\w+;)/ );
        let i;
        // 長文を途中改行できるように<wbr>を埋め込む
        for( i = 0; i < tmp.length; i++ ){
            if( !tmp[i].match( /(sm\d+|nm\d+|\d{10}|&\w+;)/ ) ){
                tmp[i] = tmp[i].replace( /(.{35,}?)/g, "$1<wbr>" );
            }
        }
        str = tmp.join( "" );
        // AA用に改行表示
        str = str.replace( /(\r\n|\r|\n)/gm, "<br>" );

        // sm,nmにリンクを貼り付け.
        str = str.replace( /((sm|nm)\d+)/g,
            "<a target=\"_blank\" href=\"http://www.nicovideo.jp/watch/$1\">$1</a>" );
        if( comment.premium != 3 ){
            // 数字10桁にもリンク.
            if( !str.match( /(sm|nm)\d+/ ) ){
                str = str.replace( /(\d{10})/g, "<a target=\"_blank\" href=\"http://www.nicovideo.jp/watch/$1\">$1</a>" );
            }
        }
        try{
            td.innerHTML = str;

            // 動画IDのサムネイル表示
            let links = td.querySelectorAll( 'a' );
            for( let i = 0, item; item = links[i]; i++ ){
                let addr = item.getAttribute( 'href' );
                let id = addr.match( /(sm|nm|so)\d+|\d{10}/ );
                if( id ){
                    item.addEventListener( 'mouseover', ( ev ) =>{
                        NicoLiveHelper.showThumbnail( ev, id[0] );
                    } );
                    item.addEventListener( 'mouseout', ( ev ) =>{
                        NicoLiveHelper.hideThumbnail();
                    } );
                }
            }

        }catch( x ){
            console.log( x );
            console.log( str );
        }

        //--- コメント日時のセル
        td = tr.insertCell( tr.cells.length );
        td.textContent = GetDateTimeString( comment.date * 1000 );

        // 自動コテハン
        this.autoKotehan( comment );

        if( comment.date >= NicoLiveHelper.connecttime ){
            let cmt = $( '#comment-view' );
            let y = cmt.scrollTop();
            if( y != 0 ){
                cmt.scrollTop( y + tr.clientHeight );
            }
        }
    },

    sendComment: function(){
        let txt = $( '#txt-input-comment' )
        let comment = txt.val();
        let mail = $( '#comment-command' ).val();

        if( !comment ) return;
        mail = mail || '';

        console.log( `送信: ${comment} ${mail}` );

        let type = parseInt( $( '#type-of-comment' ).val() );
        let isPerm = false;

        switch( type ){
        case 0: // 主コメ
            if( comment.indexOf( '/perm ' ) === 0 ){
                comment = comment.substring( 6 );
                isPerm = true;
            }
            NicoLiveHelper.postCasterComment( comment, mail, '', isPerm );
            break;

        case 1: // リスナーコメ
            NicoLiveHelper.sendComment( mail, comment );
            break;

        case 2: // TODO BSPコメ
            break;
        }

        txt.val( '' );

        // 入力文字をオートコンプリートリストに登録
        let opt = document.createElement( 'option' );
        opt.setAttribute( 'value', comment );
        let tmp = document.querySelector( '#comment-autocomplete' );
        tmp.insertBefore( opt, tmp.firstChild );

        if( $( tmp ).children( 'option' ).length > 5 ){
            tmp.removeChild( tmp.lastChild );
        }
    },

    contextMenu: function( key, options ){
        let $elem = options.$trigger;

        switch( key ){
        case 'profile':
            let user_id = $elem.attr( 'user_id' );
            OpenLink( `http://www.nicovideo.jp/user/${user_id}` );
            break;
        default:
            console.log( key );
            console.log( options.$trigger );
            break;
        }
        // console.log( options.$trigger );
    },

    initUI: function(){
        $( '#btn-send-comment' ).on( 'click', ( ev ) =>{
            this.sendComment();
        } );

        $( '#txt-input-comment' ).on( 'keydown', ( ev ) =>{
            if( ev.keyCode == 13 ){
                this.sendComment();
            }
        } );

        $.contextMenu( {
            selector: '#comment-table .comment_username',
            build: function( $triggerElement, e ){
                let user_id = $triggerElement.attr( 'user_id' );
                let menuobj = {
                    zIndex: 10,
                    callback: function( key, options ){
                        NicoLiveComment.contextMenu( key, options );
                    },
                    items: {
                        "user_id": {
                            name: `<span class="black">${$triggerElement.attr( 'comment_no' )}. ID=${($triggerElement).attr( 'user_id' )}</span>`,
                            disabled: true,
                            isHtmlName: true,
                            value: `${user_id}`
                        },
                        "set_kotehan": {
                            name: "コテハン設定",
                            type: "text",
                            value: `${NicoLiveComment.getKotehan( user_id )}`
                        },
                        "profile": {name: "プロフィールを開く"},
                        "set_reflection": {
                            name: "コメントリフレクション登録",
                            disabled: true
                        }
                    },
                    events: {
                        hide: function( opt ){
                            let $this = $( this );
                            let data = $.contextMenu.getInputValues( opt, $this.data() );
                            NicoLiveComment.setKotehan( user_id, data.set_kotehan );
                        }
                    }
                };

                if( !(user_id > 0) ){
                    menuobj.items.profile.disabled = true;
                }
                return menuobj;
            },
        } );

    },

    init: function(){
        this.initUI();
        this.table = document.querySelector( '#comment-table' );
    },
    destroy: function(){
    }
};

window.addEventListener( "unload", ( ev ) =>{
    NicoLiveComment.destroy();
}, false );

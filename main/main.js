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

var NicoLiveHelper = {
    liveProp: {},       ///< 生放送情報(ニコ生から取得する)

    connecttime: 0,     ///< 生放送への接続時刻
    nico_user_id: '',   ///< ニコニコ動画のユーザーID
    is_premium: 0,      ///< プレミアム会員かどうか

    live_begintime: 0,  ///< 放送開始時刻(UNIX時間)
    live_endtime: 0,    ///< 放送終了時刻(UNIX時間)
    /** @type {VideoInformation} */
    currentVideo: null, ///< 現在再生中の動画

    // コメント送信に必要な要素
    ticket: '',
    threadId: '',
    postkey: '',

    _autoplay_timer: null,  ///< 自動再生用タイマー

    /**
     * 放送に接続しているかを返す.
     * @return {boolean}
     */
    isConnected: function(){
        return !!this.connecttime;
    },

    /**
     * 生主なら真を返す
     * @returns {boolean}
     */
    isCaster: function(){
        try{
            // 公式放送だと isOperator が存在していない
            // TODO 生主判定はどっち？
            // return !!this.liveProp.user.isOperator;
            return this.liveProp.user.isBroadcaster;
        }catch( e ){
            return true;
        }
    },

    /**
     * BSPを持っていたら真を返す
     * @returns {boolean}
     */
    hasBSP: function(){
        try{
            return this.liveProp.user.permissions.indexOf( 'POST_BSP_COMMENT' ) !== -1;
        }catch( e ){
            return false;
        }
    },

    /**
     * プレイスタイルを返す.
     * 0: 手動
     * 1: 自動順次
     * 2: 自動ランダム
     * @returns {number}
     */
    getPlayStyle: function(){
        return parseInt( $( '#sel-playstyle' ).val() );
    },

    /**
     * リクエスト受付状態を返す
     * 0:受け付け
     * 1:不可
     * @returns {number}
     */
    getRequestAllowedStatus: function(){
        return parseInt( $( '#sel-allow-request' ).val() );
    },

    /**
     * 生放送タイトルを返す
     * @returns {String}
     */
    getLiveTitle: function(){
        try{
            return this.liveProp.program.title;
        }catch( e ){
            return '';
        }
    },

    /**
     * 生放送のIDを返す
     * @returns {String}
     */
    getLiveId: function(){
        try{
            return this.liveProp.program.nicoliveProgramId;
        }catch( e ){
            return '';
        }
    },

    /**
     * 放送しているコミュニティIDを返す
     * @returns {String|*}
     */
    getCommunityId: function(){
        try{
            return this.liveProp.community.id;
        }catch( e ){
            return null;
        }
    },

    /**
     * 動画再生時の音量設定を返す.
     * @returns {number}
     */
    getVolume: function(){
        return $( '#volume-slider' ).slider( 'value' ) / 10;
    },

    /**
     * 経過時間表示のバー長を設定する.
     * @param p パーセンテージ数
     */
    setProgressMain: function( p ){
        $( '#progressbar-main' ).width( p + "%" );
    },

    /**
     * 自動再生のインジケータ表示を設定する.
     * @param flg
     */
    setAutoplayIndicator: function( flg ){
        if( flg ){
            $( '#status-autoplay' ).addClass( 'autoplaying' );
        }else{
            $( '#status-autoplay' ).removeClass( 'autoplaying' );
        }
    },

    /**
     * ボリューム変更をする.
     * スライダーを動かすたびにリクエストするとエラーになるので
     * 2秒の猶予を持って実行する。
     */
    changeVolume: function(){
        if( this.currentVideo ){
            clearTimeout( this._change_volume_timer );
            this._change_volume_timer = setTimeout( () =>{
                this.playVideo( this.currentVideo, true );
            }, 2000 );
        }
    },

    /**
     * 動画情報をコメント
     * @param vinfo{VideoInformation}
     * @returns {Promise<void>}
     */
    sendVideoInfo: async function( vinfo ){
        let vinfo_command = [
            "vinfo-command-1",
            "vinfo-command-2",
            "vinfo-command-3",
            "vinfo-command-4"
        ];
        let vinfo_comment = [
            "vinfo-comment-1",
            "vinfo-comment-2",
            "vinfo-comment-3",
            "vinfo-comment-4"
        ];

        for( let i = 0; i < vinfo_comment.length; i++ ){
            let cmd = Config[vinfo_command[i]] || '';
            let txt = Config[vinfo_comment[i]] || '';
            if( !txt ) break;
            this.postCasterComment( txt, cmd, '', false );
            await Wait( Config['videoinfo-interval'] * 1000 );
        }
    },

    /**
     * 動画再生を停止する.
     * @returns {Promise<any>}
     */
    stopVideo: function(){
        let p = new Promise( ( resolve, reject ) =>{
            if( !this.isConnected() || !this.isCaster() ){
                reject( null );
                return;
            }

            let url = `http://live2.nicovideo.jp/unama/api/v3/programs/${this.getLiveId()}/broadcast/mixing`;
            let xhr = CreateXHR( 'PUT', url );
            xhr.onreadystatechange = () =>{
                if( xhr.readyState != 4 ) return;
                if( xhr.status != 200 ){
                    console.log( `${xhr.status} ${xhr.responseText}` );

                    // 400 {"meta":{"status":400,"errorCode":"BAD_REQUEST","errorMessage":"引用再生できない動画です"}}
                    let err = JSON.parse( xhr.responseText );
                    this.showAlert( `${err.meta.errorMessage}` );
                    //this.currentVideo = null;
                    reject( err );
                    return;
                }
                this.currentVideo = null;
                this.setProgressMain( 0 );
                this.setAutoplayIndicator( false );
                clearTimeout( this._autoplay_timer );
                this._autoplay_timer = null;
                resolve( true );
            };

            xhr.setRequestHeader( 'Content-type', 'application/json;charset=utf-8' );
            xhr.setRequestHeader( 'X-Public-Api-Token', this.liveProp.site.relive.csrfToken );

            let volume = this.getVolume();
            let data = {
                'mixing': [
                    {
                        'audio': 0,
                        'content': this.liveProp.program.nicoliveProgramId,
                        'display': 'main'
                    }
                ]
            };
            xhr.send( JSON.stringify( data ) );
        } );
        return p;
    },

    /**
     * 次の動画を再生するタイマーを設定する.
     * @param next 秒数
     */
    setNextPlayTimer: function( next ){
        clearTimeout( this._autoplay_timer );

        // 次動画再生タイマーをセットする.
        this._autoplay_timer = setTimeout( () =>{
            if( this.getPlayStyle() != 0 ){
                // タイマーが発火したときに自動再生であれば次を再生する.
                this.playNext();
            }else{
                // 手動再生設定なので自動再生はなし
                this.setAutoplayIndicator( false );
                clearTimeout( this._autoplay_timer );
                this._autoplay_timer = null;
            }
        }, next * 1000 );

        console.log( `次動画再生: ${parseInt( next )}秒後` );

        if( this.getPlayStyle() != 0 ){
            this.setAutoplayIndicator( true );
        }else{
            this.setAutoplayIndicator( false );
        }
    },

    /**
     * 動画IDを直接指定して動画を再生する.
     * @param video_id
     * @returns {Promise<void>}
     */
    playVideoDirect: async function( video_id ){
        try{
            let vinfo = await this.getVideoInfo( video_id );
            this.playVideo( vinfo );
        }catch( e ){
            this.showAlert( `${video_id} を再生できませんでした` );
        }
    },

    /**
     * 動画を再生する.
     * 動画再生に成功したら自動的に動画情報コメント送信が行われる。
     * @param vinfo{VideoInformation} 再生したい動画情報
     * @param is_change_volume trueだとボリューム変更
     * @returns {Promise<any>}
     */
    playVideo: function( vinfo, is_change_volume ){
        // 次動画の再生したあとに音量変更が走ると困るのでタイマーを取り消す
        clearTimeout( this._change_volume_timer );
        let p = new Promise( ( resolve, reject ) =>{
            if( !this.isConnected() || !this.isCaster() ){
                reject( null );
                return;
            }
            if( GetCurrentTime() >= this.live_endtime ){
                this.showAlert( `放送終了時刻を過ぎたため再生できません` );
                reject( null );
                return null;
            }

            let video_id = vinfo.video_id;
            let url = `http://live2.nicovideo.jp/unama/api/v3/programs/${this.getLiveId()}/broadcast/mixing`;

            let xhr = CreateXHR( 'PUT', url );
            xhr.onreadystatechange = () =>{
                if( xhr.readyState != 4 ) return;
                if( xhr.status != 200 ){
                    console.log( `${xhr.status} ${xhr.responseText}` );

                    // 400 {"meta":{"status":400,"errorCode":"BAD_REQUEST","errorMessage":"引用再生できない動画です"}}
                    try{
                        let err = JSON.parse( xhr.responseText );
                        this.showAlert( `${vinfo.video_id}: ${err.meta.errorMessage}` );
                        //this.currentVideo = null;
                        reject( err );
                    }catch( e ){
                        this.showAlert( `${vinfo.video_id}の再生に失敗しました` );
                        reject( null );
                    }
                    return;
                }
                this.currentVideo = CopyObject( vinfo );
                if( !is_change_volume ){
                    // 再生成功したら、再生履歴に記録する
                    NicoLiveHistory.addHistory( vinfo );
                    this.sendVideoInfo( vinfo );

                    let now = GetCurrentTime();
                    this.currentVideo.play_begin = now;
                    this.currentVideo.play_end = now + parseInt( this.currentVideo.length_ms / 1000 );

                    let next = parseInt( this.currentVideo.length_ms / 1000 + Config['autoplay-interval'] );
                    this.setNextPlayTimer( next );

                    if( Config['tweet-on-play'] ){
                        let str = this.replaceMacros( Config['tweet-text'], this.currentVideo );
                        Twitter.updateStatus( str );
                    }
                }
                resolve( true );
            };

            xhr.setRequestHeader( 'Content-type', 'application/json;charset=utf-8' );
            xhr.setRequestHeader( 'X-Public-Api-Token', this.liveProp.site.relive.csrfToken );

            let volume = this.getVolume();
            let data = {
                'mixing': [
                    {
                        'audio': 0,
                        'content': this.liveProp.program.nicoliveProgramId,
                        'display': 'none'
                    },
                    {
                        'audio': volume,
                        'content': video_id,
                        'display': 'main'
                    }
                ]
            };
            xhr.send( JSON.stringify( data ) );
        } );
        return p;
    },

    /**
     * 次の動画を再生する.
     */
    playNext: async function(){
        if( this._lock ){
            console.log( '次の動画の再生処理中です' );
            this.showAlert( '次の動画の再生待機中です' );
            return;
        }
        this._lock = true;
        try{
            await this._playNext();
        }catch( e ){
        }
        this._lock = false;
    },

    _playNext: async function(){

        let request = NicoLiveRequest.request;
        let stock = NicoLiveStock.stock;
        let ps = this.getPlayStyle();
        let is_random = document.querySelector( '#play-stock-random' ).checked;

        let ridx = request.map( ( v, i ) =>{
            return i;
        } );
        let sidx = stock.map( ( v, i ) =>{
            return i;
        } );

        if( ps == 2 ){
            ShuffleArray( ridx );
        }
        if( ps == 2 || is_random ){
            ShuffleArray( sidx );
        }

        for( let i = 0; i < ridx.length; i++ ){
            let vinfo = request[ridx[i]];
            if( vinfo.no_live_play == 0 ){
                if( Config['play-in-time'] ){
                    let remain = (this.live_endtime - GetCurrentTime()) * 1000;
                    if( vinfo.length_ms > remain ) continue;
                }
                let result = await NicoLiveRequest.playVideo( ridx[i] );
                if( result ) return;
                await Wait( 2500 );
            }
        }
        for( let i = 0; i < sidx.length; i++ ){
            let vinfo = stock[sidx[i]];
            if( vinfo.no_live_play == 0 && !vinfo.is_played ){
                if( Config['play-in-time'] ){
                    let remain = (this.live_endtime - GetCurrentTime()) * 1000;
                    if( vinfo.length_ms > remain ) continue;
                }
                let result = await NicoLiveStock.playVideo( sidx[i] );
                if( result ) return;
                await Wait( 2500 );
            }
        }

        this.showAlert( `再生できる動画がありませんでした` );
        this.setAutoplayIndicator( false );
    },

    /**
     * 現在再生している動画IDを返す.
     * mixingを叩くので生主専用。
     * @returns {Promise<any>}
     */
    getCurrentVideo: function(){
        let p = new Promise( ( resolve, reject ) =>{
            if( !this.isConnected() ){
                resolve( '' );
                return;
            }
            if( !this.isCaster() ){
                resolve( '' );
                return;
            }

            let url = `http://live2.nicovideo.jp/unama/api/v3/programs/${this.getLiveId()}/broadcast/mixing`;

            let xhr = CreateXHR( 'GET', url );
            xhr.onreadystatechange = () =>{
                if( xhr.readyState != 4 ) return;
                if( xhr.status != 200 ){
                    console.log( `${xhr.status} ${xhr.responseText}` );
                    let err = JSON.parse( xhr.responseText );
                    reject( err );
                    return;
                }

                let cur = JSON.parse( xhr.responseText );
                for( let video of cur.data.mixing ){
                    if( video.content.match( /((sm|nm)\d+)/ ) ){
                        resolve( video.content );
                    }
                }
                resolve( '' );
            };

            xhr.setRequestHeader( 'Content-type', 'application/json;charset=utf-8' );
            xhr.setRequestHeader( 'X-Public-Api-Token', this.liveProp.site.relive.csrfToken );

            xhr.send();
        } );
        return p;
    },

    /**
     * 文字列のマクロ展開を行う.
     * @param str 置換元も文字列
     * @param info 動画情報
     */
    replaceMacros: function( str, info ){
        let replacefunc = function( s, p ){
            let tmp = s;
            let expression;
            if( expression = p.match( /^=(.*)/ ) ){
                try{
                    // TODO 式マクロを実装するかどうか
                    tmp = null; //eval( expression[1] );
                    if( tmp == undefined || tmp == null ) tmp = "";
                }catch( x ){
                    tmp = "";
                }
                return tmp;
            }
            switch( p ){
            case 'id':
                if( !info.video_id ) break;
                tmp = info.video_id;
                break;
            case 'title':
                if( !info.title ) break;
                tmp = info.title;
                break;
            case 'date':
                if( !info.first_retrieve ) break;
                tmp = GetDateString( info.first_retrieve * 1000, true );
                break;
            case 'length':
                if( !info.length ) break;
                tmp = info.length;
                break;
            case 'view':
                if( !info.view_counter && 'number' != typeof info.view_counter ) break;
                tmp = FormatCommas( info.view_counter );
                break;
            case 'comment':
                if( !info.comment_num && 'number' != typeof info.comment_num ) break;
                tmp = FormatCommas( info.comment_num );
                break;
            case 'mylist':
                if( !info.mylist_counter && 'number' != typeof info.mylist_counter ) break;
                tmp = FormatCommas( info.mylist_counter );
                break;
            case 'mylistrate':
                if( !info.mylist_counter && 'number' != typeof info.mylist_counter ) break;
                if( !info.view_counter && 'number' != typeof info.view_counter ) break;
                if( info.view_counter == 0 ){
                    tmp = "0.0%";
                }else{
                    tmp = (100 * info.mylist_counter / info.view_counter).toFixed( 1 ) + "%";
                }
                break;
            case 'tags':
                // 1行40文字程度までかなぁ
                if( !info.tags['jp'] ) break;
                tmp = info.tags['jp'].join( '　' );
                // TODO 新配信ではタグが使えないので改行しない
                // tmp = tmp.replace( /(.{35,}?)　/g, "$1<br>" );
                break;
            case 'username':
                // 動画の投稿者名
                tmp = info.user_nickname || "";
                break;
            case 'pname':
                // TODO P名
                break;
            case 'additional':
                // TODO 動画DBに登録してある追加情報
                break;
            case 'description':
                // 詳細を40文字まで(世界の新着と同じ)
                tmp = info.description.match( /.{1,40}/ );
                break;

            case 'comment_no':
                // リク主のコメント番号
                tmp = info.comment_no || 0;
                break;

            case 'requestnum': // リク残数.
                let remainrequest = 0;
                NicoLiveRequest.request.forEach( function( item ){
                    if( !item.is_played && !item.no_live_play ) remainrequest++;
                } );
                tmp = remainrequest;
                break;
            case 'requesttime': // リク残時間(hh:mm:ss).
                let reqtime = NicoLiveRequest.getRequestTime();
                tmp = GetTimeString( reqtime.min * 60 + reqtime.sec );
                break;
            case 'stocknum':  // ストック残数.
                let remainstock = 0;
                NicoLiveStock.stock.forEach( function( item ){
                    if( !item.is_played && !item.no_live_play ) remainstock++;
                } );
                tmp = remainstock;
                break;
            case 'stocktime': // ストック残時間(hh:mm:ss).
                let stocktime = NicoLiveStock.getStockTime();
                tmp = GetTimeString( stocktime.min * 60 + stocktime.sec );
                break;

            case 'mylistcomment':
                // マイリストコメント
                tmp = info.mylistcomment;
                if( !tmp ) tmp = "";
                break;

            case 'pref:min-ago':
                // TODO 枠終了 n 分前通知の設定値.
                tmp = Config.notice.time;
                break;

            case 'end-time':
                // 放送の終了時刻.
                tmp = GetDateString( NicoLiveHelper.live_endtime * 1000, true );
                break;

            case 'live-id':
                tmp = NicoLiveHelper.getLiveId();
                break;
            case 'live-title':
                tmp = NicoLiveHelper.liveProp.program.title;
                break;
            }
            return tmp;
        };
        // String.replace()だとネストが処理できないので自前で置換
        let r = "";
        let token = "";
        let nest = 0;
        for( let i = 0, ch; ch = str.charAt( i ); i++ ){
            switch( nest ){
            case 0:
                if( ch == '{' ){
                    nest++;
                    token += ch;
                    break;
                }
                r += ch;
                break;
            default:
                token += ch;
                if( ch == '{' ) nest++;
                if( ch == '}' ){
                    nest--;
                    if( nest <= 0 ){
                        try{
                            r += replacefunc( token, token.substring( 1, token.length - 1 ) );
                        }catch( x ){
                        }
                        token = "";
                    }
                }
                break;
            }
        }
        return r;
    },

    /**
     * コメント送信待ち時間のミリ秒を返す.
     * コメント送信が短すぎると言われたときに何ミリ秒待機して再送信するかの時間を返す。
     * @param c エラー回数
     * @returns {number} 待機すべきミリ秒数
     */
    calcBackoffTime: function( c ){
        if( c > 5 ) c = 5;
        if( c <= 1 ) c = 2;
        let k = GetRandomInt( 1, Math.pow( 2, c ) - 1 );
        return 250 + k * 0.25 * 1000;
    },


    /**
     * 特殊コマンドの実行
     * @param text
     */
    commandComment: async function( text, mail, name ){
        let cmd = text.match( /^\/(\w+)\s+(.*)$/ );
        if( !cmd ) return;

        cmd = RegExp.$1;
        let body = RegExp.$2;

        switch( cmd ){
        case 'choice':
            let video_ids = body.split( /\s+/ );
            let choice = video_ids[GetRandomInt( 0, video_ids.length - 1 )];
            console.log( `play:${choice}` );
            if( choice.indexOf( 'db:' ) === 0 ){
                choice = await DB.choice( choice.substring( 3 ) );
                console.log( choice );
                if( !choice ){
                    return;
                }
                choice = choice.video_id;
            }
            this.playVideoDirect( choice );
            break;

        case 'perm':
            this.postCasterComment( body, mail, name, true );
            break;

        case 'press':
            if( body.match( /(.*?)\s+(.*?)\s+(.*)/ ) ){
                let color = RegExp.$1;
                let name = RegExp.$2;
                let t = RegExp.$3;
                t = this.replaceMacros( t, this.currentVideo );
                this.postBSPComment( color, t, name );
            }
            break;
        }
    },

    /**
     * 新配信で運営コメント送信をする.
     *
     * isPermコメントを消すには clearApiUrl に DELETE リクエストを送る
     *
     * @param text コメント
     * @param mail コマンド欄
     * @param name 名前
     * @param isPerm ずっと表示させる. true or false. 旧/permの役割
     * @param cnt リトライカウンター
     */
    postCasterComment: async function( text, mail, name, isPerm, cnt ){
        if( text == '' ) return;
        if( !this.isCaster() ) return;
        mail = mail || '';
        name = name || '';
        isPerm = !!isPerm;
        cnt = cnt || 0;

        if( text.indexOf( '/' ) == 0 ){
            this.commandComment( text, mail, name );
            return;
        }

        let url = this.liveProp.program.broadcasterComment.postApiUrl;
        // TODO 現状主コメは80文字までなのでマクロ展開する余地があるかどうか
        text = this.replaceMacros( text, this.currentVideo );

        let xhr = CreateXHR( 'PUT', url );
        xhr.onreadystatechange = async () =>{
            if( xhr.readyState != 4 ) return;
            if( xhr.status != 200 ){
                console.log( `${xhr.status} ${xhr.responseText}` );
                let error = JSON.parse( xhr.responseText );
                console.log( `コメント送信: ${error.meta.errorMessage || error.meta.errorCode}` );
                if( error.meta.errorMessage.match( /リクエスト間隔が短/ ) ){
                    let ms = this.calcBackoffTime( cnt + 1 );
                    console.log( `${ms}ミリ 秒待機します(${cnt + 1})` );
                    await Wait( ms );
                    this.postCasterComment( text, mail, name, isPerm, cnt + 1 );
                }else{
                    this.showAlert( `コメント送信: ${error.meta.errorMessage || error.meta.errorCode}` );
                }
                return;
            }
            console.log( `Comment posted: ${xhr.responseText}` );
        };

        xhr.setRequestHeader( 'X-Public-Api-Token', this.liveProp.site.relive.csrfToken );

        let form = new FormData();
        form.append( 'text', text );
        form.append( 'command', mail );
        form.append( 'name', name );
        form.append( 'isPermanent', isPerm );
        xhr.send( form );
    },

    /**
     * 使えるカラーは white,red,green,blue,cyan,yellow,purple,pink,orange,niconicowhite
     * @param color
     * @param text
     * @param name
     */
    postBSPComment: function( color, text, name, cnt ){
        if( !this.hasBSP() && !this.isCaster() ){
            this.showAlert( `バックステージパスがありません` );
            return;
        }
        if( !text ) return;

        let url = `http://live2.nicovideo.jp/unama/api/v3/programs/${this.getLiveId()}/bsp_comment`;
        // let url = this.liveProp.program.bsp.commentPostApiUrl;
        color = color || 'cyan';
        name = name || this.liveProp.user.nickname;
        cnt = cnt || 0;

        let xhr = CreateXHR( 'POST', url );
        xhr.onreadystatechange = async () =>{
            if( xhr.readyState != 4 ) return;
            if( xhr.status != 200 ){
                console.log( `${xhr.status} ${xhr.responseText}` );
                let error = JSON.parse( xhr.responseText );
                console.log( `コメント送信: ${error.meta.errorMessage || error.meta.errorCode}` );
                if( error.meta.errorMessage.match( /リクエスト間隔が短/ ) ){
                    let ms = this.calcBackoffTime( cnt + 1 );
                    console.log( `${ms}ミリ 秒待機します(${cnt + 1})` );
                    await Wait( ms );
                    this.postBSPComment( color, text, name, cnt + 1 );
                }else{
                    this.showAlert( `コメント送信: ${error.meta.errorMessage || error.meta.errorCode}` );
                }
                return;
            }
            console.log( `Comment posted: ${xhr.responseText}` );
        };

        xhr.setRequestHeader( 'X-Public-Api-Token', this.liveProp.site.relive.csrfToken );

        let form = new FormData();
        form.append( 'text', text );
        form.append( 'name', name );
        form.append( 'color', color );
        xhr.send( form );
    },


    /**
     * @param threadId
     * @private
     */
    getpostkey: function( threadId ){
        let getpostkey = {
            "type": "watch",
            "body": {"params": [threadId], "command": "getpostkey"}
        };
        this._comm.send( JSON.stringify( getpostkey ) );
    },

    /**
     * 視聴者コメントをする.
     * @param mail
     * @param text
     */
    sendComment: function( mail, text ){
        if( !text ) return;
        // JASRACコードの-を=に変換
        text = text.replace( /((...)[-](....)[-](.))/g, "$2=$3=$4" );

        this._getpostkeyfunc = () =>{
            this.sendComment( mail, text );
        };

        if( Config['comment-184'] ){
            mail += " 184";
        }

        let t = Math.min( this.live_begintime, this.liveProp.program.openTime );
        let vpos = Math.floor( (GetCurrentTime() - t) * 100 );
        // console.log( vpos );
        let chat = {
            "chat": {
                "thread": this.threadId,
                "vpos": vpos,
                "mail": mail,
                "ticket": this.ticket,
                "user_id": this.nico_user_id,
                "premium": this.is_premium,
                "postkey": this.postkey,
                "content": text
            }
        };
        this._comment_svr.send( JSON.stringify( chat ) );
        // console.log( chat );
    },

    /**
     * 主コメを処理する.
     * @param chat{Comment}
     */
    processCasterComment: function( chat ){
        let text = chat.text_notag;

        if( text.match( /((sm|nm)\d+)/ ) ){
            // 視聴者のとき、主コメ内の動画IDを再生したものとみなして再生履歴に追加する.
            let video_id = RegExp.$1;
            let f = async () =>{
                let flg = await this.isAvailableInNewLive( video_id );
                if( flg ){
                    let vinfo = await this.getVideoInfo( video_id );
                    NicoLiveHistory.addHistory( vinfo );
                }
            };
            f();
        }
    },

    /**
     * スタートアップコメントを送信する.
     * @returns {Promise<void>}
     */
    sendStartupComment: async function(){
        if( !this.isCaster() ) return;
        let liveprogress = GetCurrentTime() - this.live_begintime;
        // 3分経過したらスタートアップコメントしない
        if( liveprogress > 180 ) return;

        let db = CCDB.initDB();

        // コミュニティID、スタートアップコメント設定の順で連続コメントを探す
        let keys = [];
        let by_community = Config['startup-comment-by-community'];
        if( by_community ){
            keys.push( this.getCommunityId() );
        }
        if( Config['startup-comment'] ){
            keys.push( Config['startup-comment'] );
        }

        let text;
        for( let k of keys ){
            let file = await db.ccfile.get( k );
            text = file && file.text;
            if( text ) break;
        }
        if( !text ) return;

        let text_array = text.split( /\n|\r|\r\n/ );
        for( let line of text_array ){
            await Wait( 5000 );
            console.log( line );
            this.postCasterComment( line, '', '', false );
        }
    },

    /**
     * 視聴者コメントを処理する.
     */
    processListenersComment: function( chat ){
        let text = chat.text_notag;

        if( text.match( /((sm|nm)\d+)/ ) ){
            let video_id = RegExp.$1;
            let is_self_request = !!text.match( /[^他](貼|張)|自|関/ );
            let code = "";
            // 作品コードの処理
            code = chat.text.match( /(...[-+=/]....[-+=/].)/ )[1];
            code = code.replace( /[-+=/]/g, "-" ); // JWID用作品コード.

            if( this.getRequestAllowedStatus() == 0 ){
                NicoLiveRequest.addRequest( video_id, chat.comment_no, chat.user_id, is_self_request, code );
            }else{
                NicoLiveRequest.sendReply( 'request-not-allow',
                    {video_id: video_id, comment_no: chat.comment_no} );
            }
        }
        if( text.match( /(\d{10})/ ) ){
            // TODO 現状、新配信ではチャンネル動画は再生できない
            let video_id = RegExp.$1;
            if( video_id == "8888888888" ) return;
            let is_self_request = !!text.match( /[^他](貼|張)|自|関/ );
            let code = "";
            // NicoLiveRequest.addRequest( video_id, chat.comment_no, chat.user_id, is_self_request, code );
        }
    },

    /**
     * 受信したコメントを処理する.
     * @param chat{Comment}
     */
    processComment: function( chat ){
        NicoLiveComment.addComment( chat );

        switch( chat.premium ){
        case 2: // チャンネル生放送の場合、こちらの場合もあり。/infoコマンドなどもココ
        case 3: // 運営コメント
        case 7: // 運営コメントにnameパラメータ付けるとこれになる？ BSPもこれになる
            if( chat.text.match( /^\/disconnect/ ) ){
                this.showAlert( `放送が終了しました`, true );
                this.live_endtime = 0;
                clearTimeout( this._autoplay_timer );
                this._autoplay_timer = null;
                this.setAutoplayIndicator( false );
            }
            if( chat.date < this.connecttime ) return;
            if( this.isCaster() ) return;
            this.processCasterComment( chat );

            // コメント読み上げ
            if( Config['do-speech'] && Config['do-speech-caster-comment'] ){
                if( chat.date > this.connecttime ){
                    if( chat.text_notag.indexOf( '/' ) !== 0 ){
                        Talker.speech2(
                            chat.text_notag, Config['webspeech-select-voice'],
                            Config['webspeech-volume'], Config['webspeech-speed']
                        );
                    }
                }
            }
            break;

        case 1: // プレミアム会員
        case 0: // 一般会員
            // リスナーコメント
            // 接続時より前のコメントは反応しないようにする
            if( this.isCaster() && chat.date < this.connecttime ) return;
            this.processListenersComment( chat );
            NicoLiveComment.reflection( chat );

            // コメント読み上げ
            if( Config['do-speech'] ){
                if( chat.date > this.connecttime ){
                    Talker.speech2(
                        chat.text_notag, Config['webspeech-select-voice'],
                        Config['webspeech-volume'], Config['webspeech-speed']
                    );
                }
            }
            break;

        default:
            break;
        }
    },

    /**
     * コメントサーバーからコメントデータを受け取ったときの処理.
     * @param data
     */
    onCommentReceived: function( data ){
        // console.log( data );    // TODO コメント受信したときのログ表示
        if( data.thread ){
            // data.thread.ticket;
            // data.thread.last_res;
            // data.thread.resultcode;
            this.ticket = data.thread.ticket;
            console.log( `ticket:${this.ticket}` );
        }

        if( data.chat_result ){
            let result = data.chat_result;
            switch( result.status ){
            case 4:
                // コメントするには postkey の再取得が必要
                this.getpostkey( this.threadId );
                break;

            case 1:
                // 送信テキストが空のときに発生する
                this.showAlert( `コメントの送信エラー(送信過多など)です` );
                break;
            case 8:
                this.showAlert( `コメントが長すぎます` );
                break;

            default:
                break;
            }
        }

        if( data.chat ){
            let chat = data.chat;
            // 念のために従来のように値がなかった時のため
            chat.mail = chat.mail || "";
            chat.name = chat.name || "";
            chat.locale = chat.locale || "";
            chat.score = chat.score || 0;   // スコアは負の数
            chat.date = chat.date || 0;     // UNIX時間
            chat.premium = chat.premium || 0;
            chat.user_id = chat.user_id || "0";
            chat.anonymity = chat.anonymity || 0;
            chat.no = chat.no || 0;
            chat.comment_no = chat.no;
            chat.text = chat.content;

            chat.yourpost = chat.yourpost || 0; // 自分のコメントかどうかの1 or 0
            if( chat.user_id == this.nico_user_id ){
                // yourpostは過去ログには適用されないので自身で判断
                // ただし184だと識別できないのでユーザーIDが一致するときだけ。
                chat.yourpost = 1;
            }

            if( chat.premium == 3 || chat.premium == 2 ){
                // 主コメ
                chat.text_notag = chat.text.replace( /<.*?>/g, "" );
            }else{
                chat.text_notag = chat.text;
            }

            this.processComment( chat );
        }
    },

    /**
     * プログレスバーの表示を初期状態にする.
     * @returns {Promise<void>}
     */
    initProgressBar: async function(){
        let video_id = await this.getCurrentVideo();
        if( !video_id ) return;

        let vinfo = await this.getVideoInfo( video_id );
        this.currentVideo = vinfo;
        this.currentVideo.play_begin = GetCurrentTime();
        this.currentVideo.play_end = GetCurrentTime();
        $( '#remaining-time-main' ).text( vinfo.title );
    },

    /**
     * WebSocketでコメントサーバーに接続する.
     * @param room
     */
    connectCommentServer: function( room ){
        console.log( 'connect comment server(websocket)...' );
        console.log( `websocket uri: ${room.messageServerUri}` );
        console.log( `thread id: ${room.threadId}` );
        console.log( `room name: ${room.roomName}` );
        console.log( `server type: ${room.messageServerType}` );

        this.threadId = room.threadId;

        // sub-protocol "msg.nicovideo.jp#json"
        this._comment_svr = new Comm( room.messageServerUri, "msg.nicovideo.jp#json" );
        this._comment_svr.connect();
        this._comment_svr.onConnect( ( ev ) =>{
            console.log( 'comment server connected.' );
            this.connecttime = GetCurrentTime();

            // 過去ログ取得行数指定
            let lines = Config['comment-backlog-num'] * -1;
            // let lines = -50;
            let str = {
                "thread": {
                    "thread": "" + room.threadId,
                    "version": "20061206",
                    "fork": 0,
                    "user_id": this.nico_user_id,
                    "res_from": lines,
                    "with_global": 1,
                    "scores": 1,
                    "nicoru": 0,
                    "userkey": ""
                }
            };
            this._comment_svr.send( JSON.stringify( str ) );
            // TODO サーバーに接続した時の処理をここに書く
            this.showAlert( `コメントサーバーに接続しました` );

            // 再生履歴に番組名と開始時刻を記録
            let hist;
            hist = `${this.liveProp.program.nicoliveProgramId} ${this.liveProp.program.title} (${GetDateString( this.liveProp.program.beginTime * 1000, true )}-)\n`;
            NicoLiveHistory.addHistoryText( hist );

            (async () =>{
                await this.initProgressBar();
                if( !this.currentVideo ){
                    this.sendStartupComment();
                }
            })();
        } );
        this._comment_svr.onReceive( ( ev ) =>{
            let data = JSON.parse( ev.data );
            this.onCommentReceived( data );
        } );
        this._comment_svr.onError( ( ev ) =>{
            console.log( ev );
            let str = `コメントサーバーとの接続でエラーが発生しました`;
            this.showAlert( str, true );
            alert( str );
        } );
    },

    onWatchCommandReceived: function( data ){
        // console.log( data ); // TODO 受信時のログ表示
        let body = data.body;
        switch( data.type ){
        case 'watch':
            switch( body.command ){
            case 'userstatus':
                // HTML5ならthis.liveProp.userStatusにも格納されている
                this.nico_user_id = body.params[0];
                // プレミアム会員フラグ
                this.is_premium = body.params[1].match( /true/i ) ? 1 : 0;
                // 公式放送だと isCommentable フラグで受け取るコメント内容が違う
                // 実際、HTML5版とFlash版プレイヤーで内容が違う
                let getpermit = {
                    "type": "watch",
                    "body": {
                        "command": "getpermit",
                        "requirement": {
                            "broadcastId": this.liveProp.program.broadcastId,
                            "route": "",
                            // "stream": {"protocol": "hls", "requireNewStream": true, "priorStreamQuality": "high"},
                            "room": {"isCommentable": true, "protocol": "webSocket"}
                        }
                    }
                };
                this._comm.send( JSON.stringify( getpermit ) );
                break;
            case 'rooms':
                // TODO body.rooms[] に立ち見席などの情報
                break;
            case 'servertime':
                // サーバー時刻
                // let svrtime = new Date( parseInt( body.params[0] ) );
                // DebugLog( `svr time: ${svrtime}` );
                break;
            case 'permit':
                // 不明
                break;
            case 'currentstream':
                // ライブ動画配信のアドレス
                console.log( 'currentstream' );
                console.log( data );
                break;
            case 'currentroom':
                // コメントサーバー
                this.connectCommentServer( body.room );
                this.getpostkey( body.room.threadId );
                break;
            case 'statistics':
                // body.params[0]; // 来場者数
                // body.params[1]; // コメント数
                // body.params[2]; // 不明
                // body.params[3]; // 不明
                // リスナー数更新
                console.log( `Now ${body.params[0]} listeners. ${body.params[1]} comments.` );
                $( '#number-of-listeners' ).text( FormatCommas( body.params[0] ) );
                break;
            case 'watchinginterval':
                // body.params[0]; // 何かの間隔秒数
                break;
            case 'schedule':
                // 放送時間の更新か？
                // body.update.begintime;
                // body.update.endtime;
                console.log( `begin time:${body.update.begintime}, end time:${body.update.endtime}` );
                $( '#live-progress' ).attr( 'title', `終了日時: ${GetDateTimeString( body.update.endtime, 1 )}` );
                this.live_begintime = parseInt( body.update.begintime / 1000 );
                this.live_endtime = parseInt( body.update.endtime / 1000 );
                break;
            case 'postkey':
                this.postkey = body.params[0];
                // body.params[0]; // postkey
                // body.params[1]; // null
                // body.params[2]; // 何かの数字postkeyに含まれるものと同じ
                console.log( `postkey:${this.postkey}` );

                if( "function" === typeof this._getpostkeyfunc ){
                    this._getpostkeyfunc();
                    this._getpostkeyfunc = null;
                }
                break;
            }

            break;
        case 'ping':
            this._comm.send( JSON.stringify( {"type": "pong", "body": {}} ) );
            break;
        }
    },

    /**
     *　ニコ生に接続開始する.
     */
    connectServer: function(){
        console.log( 'connect websocket' );
        let ws = this.liveProp.site.relive.webSocketUrl;

        this._comm = new Comm( ws );
        this._comm.connect();
        this._comm.onConnect( ( ev ) =>{
            console.log( `websocket connected. ${this.liveProp.program.nicoliveProgramId}` );
            setTimeout( () =>{
                let getuserstatus = {"type": "watch", "body": {"params": [], "command": "getuserstatus"}};
                this._comm.send( JSON.stringify( getuserstatus ) );
            }, 100 );
        } );
        this._comm.onReceive( ( ev ) =>{
            let data = JSON.parse( ev.data );
            this.onWatchCommandReceived( data );
        } );
    },


    /**
     * 動画情報のXMLをJavascriptオブジェクトにする.
     *
     * @param xml
     * @returns {Object}
     * @throw String エラーコードを例外として投げる
     */
    extractVideoInfo: function( xml ){
        // ニコニコ動画のgetthumbinfoのXMLから情報抽出.
        let info = new VideoInformation();

        let error = GetXmlText( xml, "/nicovideo_thumb_response/error/code" );
        if( error ){
            // COMMUNITY or NOT_FOUND or DELETED
            throw error;
        }

        let root;
        root = xml.getElementsByTagName( 'thumb' )[0];
        if( !root ) throw "no thumb tag";

        let tags = ["jp", "tw", "us"];
        let tagscnt = 0;
        for( let i = 0, elem; elem = root.childNodes[i]; i++ ){
            switch( elem.tagName ){
            case "user_id":
                info.user_id = elem.textContent;
                break;
            case "user_nickname":
                // 投稿者名
                info.user_nickname = elem.textContent;
                break;
            case "video_id":
                info.video_id = elem.textContent;
                break;
            case "title":
                info.title = restorehtmlspecialchars( elem.textContent );
                break;
            case "description":
                info.description = restorehtmlspecialchars( elem.textContent ).replace( /　/g, ' ' );
                info.description = info.description.replace( /<.*?>/g, "" );
                break;
            case "thumbnail_url":
                info.thumbnail_url = elem.textContent;
                break;
            case "first_retrieve":
                // Firefox 4からISO 8601フォーマットを読めるのでそのまま利用
                let d = new Date( elem.textContent );
                info.first_retrieve = d.getTime() / 1000; // seconds from epoc.
                break;
            case "length":
                // TODO getthumbinfoの情報と実際の再生時間が違う動画がある
                if( 0 && this._videolength["_" + info.video_id] ){
                    // getthumbinfo のデータと実際が合わない動画があるので調整データベースから
                    info.length = this._videolength["_" + info.video_id];
                }else{
                    info.length = elem.textContent;
                }
                let len = info.length.match( /\d+/g );
                info.length_ms = (parseInt( len[0], 10 ) * 60 + parseInt( len[1], 10 )) * 1000;
                break;
            case "view_counter":
                info.view_counter = parseInt( elem.textContent );
                break;
            case "comment_num":
                info.comment_num = parseInt( elem.textContent );
                break;
            case "mylist_counter":
                info.mylist_counter = parseInt( elem.textContent );
                break;
            case "tags":
                // attribute domain=jp のチェックが必要.
                // また、半角に正規化.
                let domain = elem.getAttribute( 'domain' ) || 'jp';
                let tag = elem.getElementsByTagName( 'tag' );
                if( !info.tags ){
                    info.tags = {};
                    info.tags_locked = {};
                }
                if( !info.tags[domain] ){
                    info.tags[domain] = [];
                    info.tags_locked[domain] = [];
                }
                else{
                    domain = 'tag' + tagscnt;
                    info.tags[domain] = [];
                    info.tags_locked[domain] = [];
                }
                if( !info.tags_array ) info.tags_array = [];
                for( let i = 0, item; item = tag[i]; i++ ){
                    let tag = restorehtmlspecialchars( ZenToHan( item.textContent ) );
                    info.tags[domain].push( tag );
                    info.tags_array.push( tag );

                    let tmp = item.getAttribute( 'lock' );
                    info.tags_locked[domain].push( !!tmp );
                }
                tagscnt++;
                break;
            case "size_high":
                info.filesize = parseInt( elem.textContent );
                info.highbitrate = elem.textContent;
                info.highbitrate = (info.highbitrate * 8 / (info.length_ms / 1000) / 1000).toFixed( 2 ); // kbps "string"
                break;
            case "size_low":
                info.lowbitrate = elem.textContent;
                info.lowbitrate = (info.lowbitrate * 8 / (info.length_ms / 1000) / 1000).toFixed( 2 ); // kbps "string"
                break;
            case "movie_type":
                info.movie_type = elem.textContent;
                break;
            case "no_live_play":
                info.no_live_play = parseInt( elem.textContent );
                break;
            default:
                break;
            }
        }
        // video_id がないときはエラーとしておこう、念のため.
        if( !info.video_id ){
            throw "no video id.";
        }

        // TODO P名取得
        // try{
        //     info.pname = this.getPName( info );
        // }catch( x ){
        //     info.pname = "";
        // }

        try{
            info.mylistcomment = NicoLiveMylist.mylist_itemdata["_" + info.video_id].description;
        }catch( x ){
            info.mylistcomment = "";
        }

        // TODO 機械学習による分類機能
        // if( Config.do_classify  ){
        //     let str = new Array();
        //     // 半角小文字で正規化してトレーニングをしているので、分類するときもそのように.
        //     for( k in info.tags ){
        //         for( let i = 0, tag; tag = info.tags[k][i]; i++ ){
        //             str.push( ZenToHan( tag.toLowerCase() ) );
        //         }
        //     }
        //     info.classify = NicoLiveClassifier.classify( str );
        // }

        return info;
    },

    /**
     * 動画情報を取得する.
     * @param video_id
     * @returns {Promise}
     */
    getVideoInfo: function( video_id ){
        let p1 = new Promise( ( resolve, reject ) =>{
            NicoApi.getthumbinfo( video_id, ( xml, req ) =>{
                try{
                    let vinfo = NicoLiveHelper.extractVideoInfo( xml );
                    vinfo.video_id = video_id;
                    resolve( vinfo );
                }
                catch( e ){
                    if( e === 'DELETED' ){
                    }
                    console.log( 'extract failed:' + e + ' ' + video_id );
                    reject( e );
                }
            } );
        } );
        return p1;
    },

    /**
     * 新配信で再生できる動画かどうかを返す.
     * 再生できなければ false, 再生できるなら動画IDとタイトルのオブジェクトを返す.
     * @param video_id
     * @returns {Promise<any>}
     */
    isAvailableInNewLive: function( video_id ){
        let url = `http://live2.nicovideo.jp/unama/api/v3/contents/${video_id}`;
        let p = new Promise( ( resolve, reject ) =>{
            let xhr = CreateXHR( 'GET', url );
            xhr.onreadystatechange = () =>{
                if( xhr.readyState != 4 ) return;
                if( xhr.status != 200 ){
                    //let err = JSON.parse( xhr.responseText );
                    resolve( false );
                    return;
                }
                let res = JSON.parse( xhr.responseText );
                resolve( res.data );
            };
            xhr.send();
        } );
        return p;
    },

    /**
     * 配列をソートする.
     * @param queue ソートする配列
     * @param type ソート方法
     * @param order 昇順(1) or 降順(-1)
     */
    sortVideoList: function( queue, type, order ){
        // order:1だと昇順、order:-1だと降順.
        queue.sort( function( a, b ){
            let tmpa, tmpb;
            switch( type ){
            case 0:// 再生数.
                tmpa = a.view_counter;
                tmpb = b.view_counter;
                break;
            case 1:// コメ.
                tmpa = a.comment_num;
                tmpb = b.comment_num;
                break;
            case 2:// マイリス.
                tmpa = a.mylist_counter;
                tmpb = b.mylist_counter;
                break;
            case 3:// 時間.
                tmpa = a.length_ms;
                tmpb = b.length_ms;
                break;
            case 4:// 投稿日.
            default:
                tmpa = a.first_retrieve;
                tmpb = b.first_retrieve;
                break;
            case 5:// マイリス率.
                tmpa = a.mylist_counter / a.view_counter;
                tmpb = b.mylist_counter / b.view_counter;
                break;
            case 6:// タイトル.
                if( a.title < b.title ){
                    return -order;
                }else{
                    return order;
                }
                break;
            case 7:// マイリス登録日.
                tmpa = a.registerDate;
                tmpb = b.registerDate;
                break;
            case 8:// 宣伝ポイント.
                tmpa = a.uadp;
                tmpb = b.uadp;
                break;
            case 9:// ビットレート
                tmpa = a.highbitrate;
                tmpb = b.highbitrate;
                break;
            }
            return (tmpa - tmpb) * order;
        } );
    },

    /**
     * 動画情報の表示用のエレメントを作成して返す.
     * @param vinfo{VideoInformation}
     * @returns {Node}
     */
    createVideoInfoElement: function( vinfo ){
        let t = document.querySelector( '#template-video-info' );
        let clone2 = document.importNode( t.content, true );
        let elem = clone2.firstElementChild;
        elem.setAttribute( 'nico_video_id', vinfo.video_id );
        if( vinfo.is_played ){
            $( elem ).addClass( 'video_played' );
        }

        let thumbnail_image = elem.querySelector( '.nico-thumbnail' );
        let bitrate = elem.querySelector( '.nico-bitrate' );
        let title = elem.querySelector( '.nico-title' );
        let video_prop = elem.querySelector( '.nico-video-prop' );
        let description = elem.querySelector( '.nico-description' );
        let tags = elem.querySelector( '.nico-tags' );
        let link = elem.querySelector( '.nico-link' );
        let rights_code = elem.querySelector( '.rights-code' );

        $( rights_code ).text( vinfo.rights_code );

        if( vinfo.no_live_play ){
            $( title ).addClass( 'no_live_play' );
        }
        if( vinfo.is_self_request ){
            $( elem ).addClass( 'self_request' );
            $( title ).addClass( 'self_request' );
        }

        link.setAttribute( "href", "http://www.nicovideo.jp/watch/" + vinfo.video_id );

        thumbnail_image.src = vinfo.thumbnail_url;
        thumbnail_image.addEventListener( 'mouseover', ( ev ) =>{
            NicoLiveHelper.showThumbnail( ev, vinfo.video_id );
        } );
        thumbnail_image.addEventListener( 'mouseout', ( ev ) =>{
            NicoLiveHelper.hideThumbnail();
        } );

        bitrate.textContent = vinfo.highbitrate.substring( 0, vinfo.highbitrate.length - 3 ) + 'k/' + vinfo.movie_type;
        title.textContent = vinfo.video_id + ' ' + vinfo.title;
        let tmp = GetDateString( vinfo.first_retrieve * 1000, true );
        video_prop.textContent = '投:' + tmp + ' 再:' + FormatCommas( vinfo.view_counter )
            + ' コ:' + FormatCommas( vinfo.comment_num ) + ' マ:' + FormatCommas( vinfo.mylist_counter ) + ' 時間:' + vinfo.length;

        //--- description
        // description.textContent = vinfo.description;
        {
            let div2 = document.createElement( 'div' );
            let str;
            str = vinfo.description.split( /(mylist\/\d+|sm\d+|nm\d+)/ );
            for( let i = 0; i < str.length; i++ ){
                let s = str[i];
                if( s.match( /mylist\/\d+/ ) ){
                    let a = document.createElement( 'a' );
                    let mylist = s;
                    a.setAttribute( "href", "http://www.nicovideo.jp/" + mylist );
                    a.setAttribute( "target", "_blank" );
                    a.setAttribute( "style", "text-decoration: underline;" );
                    a.appendChild( document.createTextNode( s ) );
                    div2.appendChild( a );
                }else if( s.match( /(sm|nm)\d+/ ) ){
                    let a = document.createElement( 'a' );
                    let vid = s;
                    a.setAttribute( "href", "http://www.nicovideo.jp/watch/" + vid );
                    a.setAttribute( "target", "_blank" );
                    a.setAttribute( "style", "text-decoration: underline;" );

                    a.addEventListener( 'mouseover', ( ev ) =>{
                        NicoLiveHelper.showThumbnail( ev, vid );
                    } );
                    a.addEventListener( 'mouseout', ( ev ) =>{
                        NicoLiveHelper.hideThumbnail();
                    } );
                    a.appendChild( document.createTextNode( s ) );
                    div2.appendChild( a );
                }else{
                    div2.appendChild( document.createTextNode( s ) );
                }
            }
            description.appendChild( div2 );
        }

        vinfo.tags['jp'].forEach( ( elem, idx, arr ) =>{
            let tag = document.createElement( 'span' );
            tag.setAttribute( 'class', 'badge badge-secondary' );
            tag.textContent = elem + ' ';

            if( vinfo.tags_locked['jp'][idx] ){
                let lockicon = document.createElement( 'span' );
                lockicon.setAttribute( 'class', 'glyphicon glyphicon-lock' );
                lockicon.setAttribute( 'aria-hidden', 'true' );
                tag.append( lockicon );
            }

            tags.appendChild( tag );
            tags.appendChild( document.createTextNode( ' ' ) );
        } );
        return elem;
    },

    /**
     * リストに含まれている動画の合計時間を返す.
     * @param list
     * @returns {{min: (Number|*), sec: (number|*)}}
     */
    calcTotalVideoTime: function( list ){
        let t = 0;
        let s;

        for( let i = 0, item; item = list[i]; i++ ){
            s = item.length_ms;
            t += s;
        }
        t /= 1000;
        let min, sec;
        min = parseInt( t / 60 );
        sec = t % 60;
        if( sec < 10 ){
            sec = '0' + sec;
        }
        return {"min": min, "sec": sec};
    },

    /**
     * 動画サムネイルを表示する.
     * @param event DOMイベント
     * @param video_id 動画ID
     */
    showThumbnail: function( event, video_id ){
        document.querySelector( '#iframe-thumbnail' ).src = "http://ext.nicovideo.jp/thumb/" + video_id;
        let x, y;
        // 312x176
        x = event.clientX;
        y = event.clientY;
        if( y + 176 > window.innerHeight ){
            y = y - 176 - 10;
        }
        if( x + 312 > window.innerWidth ){
            x = x - 312 - 10;
        }
        document.querySelector( '#iframe-thumbnail' ).style.left = x + 5 + "px";
        document.querySelector( '#iframe-thumbnail' ).style.top = y + 5 + "px";
        document.querySelector( '#iframe-thumbnail' ).style.display = 'block';
        document.querySelector( '#iframe-thumbnail' ).width = 312;
        document.querySelector( '#iframe-thumbnail' ).height = 176;
        document.querySelector( '#iframe-thumbnail' ).style.opacity = 1;
    },

    /**
     * 動画サムネイルを非表示にする.
     */
    hideThumbnail: function(){
        document.querySelector( '#iframe-thumbnail' ).width = 312;
        document.querySelector( '#iframe-thumbnail' ).height = 0;
        document.querySelector( '#iframe-thumbnail' ).style.opacity = 0;
    },

    /**
     * ウィンドウ下部にアラートメッセージを表示する.
     * @param text
     */
    showAlert: function( text, nohide ){
        $( '#my-alert-message' ).text( text );
        $( '#my-alert' ).show( 100 );

        clearTimeout( this._alert_timer );
        if( !nohide ){
            this._alert_timer = setTimeout( function(){
                $( '#my-alert' ).hide( 100 );
            }, 4000 );
        }
    },


    updateVideoProgress: function( now ){
        // 動画の経過時間
        try{
            let current = this.currentVideo;
            let remain = current.play_end - now;
            if( remain < 0 ) remain = 0;
            $( '#remaining-time-main' ).text( `${current.title}(-${GetTimeString( remain )})` );

            let len = parseInt( current.length_ms / 1000 );
            let t = now - current.play_begin;

            let percent = parseInt( (t / len) * 100 );
            if( percent > 100 ) percent = 100;
            this.setProgressMain( percent );
        }catch( e ){
            $( '#remaining-time-main' ).text( `---(-0:00)` );
        }
    },

    /**
     * 毎秒更新処理.
     */
    update: function(){
        let now = GetCurrentTime();

        this.updateVideoProgress( now );

        // 生放送の経過時間
        if( this.live_begintime ){
            let liveprogress = now - this.live_begintime;
            $( '#live-progress' ).text( liveprogress < 0 ? `-${GetTimeString( -liveprogress )}` : GetTimeString( liveprogress ) );
        }
    },

    test: async function(){
        let obj = {
            code: '12345',
            title: 'title-name'
        };
        browser.storage.local.set( {
            'jwid': obj
        } );
    },

    initUI: async function(){
        $( '#btn-play-next' ).on( 'click', ( ev ) =>{
            // 次を再生
            this.playNext();
        } );

        $( '#btn-stop-play' ).on( 'click', ( ev ) =>{
            // 再生停止
            this.stopVideo();
        } );

        /* ストックのランダム再生オプション */
        let flg = localStorage.getItem( 'stock-random' ) || false;
        flg = flg === 'true';
        document.querySelector( '#play-stock-random' ).checked = flg;

        let fstockplay = ( f ) =>{
            document.querySelector( '#icon-stock-random' ).style.display = f ? 'inline' : 'none';
        };
        fstockplay( flg );
        $( '#play-stock-random' ).on( 'change', ( ev ) =>{
            let flg = document.querySelector( '#play-stock-random' ).checked;
            fstockplay( flg );
            localStorage.setItem( 'stock-random', flg );
        } );

        /* プレイスタイルの変更 */
        $( '#sel-playstyle' ).on( 'change', ( ev ) =>{
            if( this.getPlayStyle() == 0 ){
                this.setAutoplayIndicator( false );
            }else{
                if( this._autoplay_timer ){
                    this.setAutoplayIndicator( true );
                }else{
                    this.setAutoplayIndicator( false );
                }
            }
            browser.storage.local.set( {'playstyle': this.getPlayStyle()} );
        } );
        let ps = (await browser.storage.local.get( 'playstyle' )).playstyle || 0;
        $( '#sel-playstyle' ).val( ps );

        // マイリストマネージャーを開く
        $( '#mylist-manager' ).on( 'click', ( ev ) =>{
            window.open( 'mylistmanager/mylistmanager.html', 'nicolivehelperx_mylistmanager',
                'width=640,height=480,menubar=no,toolbar=no,location=no' );
        } );

        // 動画DBを開く
        $( '#open-video-db' ).on( 'click', ( ev ) =>{
            window.open( 'db/videodb.html', 'nicolivehelperx_videodb',
                'width=640,height=480,menubar=no,toolbar=no,location=no' );
        } );

        // 連続コメントを開く
        $( '#continuous-comment' ).on( 'click', ( ev ) =>{
            window.open( 'cc/continuouscomment.html', 'nicolivehelperx_cc',
                'width=320,height=320,menubar=no,toolbar=no,location=no' );
        } );

        // コメントを保存する
        $( '#save-comment' ).on( 'click', ( ev ) =>{
            NicoLiveComment.saveFile();
        } );

        // 設定を開く
        $( '#open-settings' ).on( 'click', ( ev ) =>{
            browser.runtime.openOptionsPage();
        } );

        // ウィンドウを閉じる
        $( '#close-window' ).on( 'click', ( ev ) =>{
            window.close();
        } );


        /* リクエスト受付状態の変更 */
        let frequest = () =>{
            switch( this.getRequestAllowedStatus() ){
            case 0:
                $( '#status-allow-request' ).addClass( 'allowrequest' );
                break;
            default:
                $( '#status-allow-request' ).removeClass( 'allowrequest' );
                break;
            }
        };
        $( '#sel-allow-request' ).on( 'change', ( ev ) =>{
            frequest();
        } );
        frequest();

        /* 音量スライダー */
        let handle = $( "#custom-handle" );
        let vol = parseInt( Config['play-default-volume'] / 10 );
        $( "#volume-slider" ).slider( {
            value: vol,
            max: 10,
            min: 0,
            create: function(){
                handle.text( $( this ).slider( "value" ) * 10 );
            },
            slide: function( event, ui ){
                handle.text( ui.value * 10 );
                NicoLiveHelper.changeVolume();
            }
        } );

        /* 再生中動画インジケーターのメニュー操作 */
        $.contextMenu( {
            selector: '#progressbar',
            build: ( $triggerElement, e ) =>{
                let menuobj = {
                    zIndex: 10,
                    callback: ( key, options ) =>{
                        if( !this.currentVideo ) return;
                        switch( key ){
                        case 'copy':
                            CopyToClipboard( this.currentVideo.video_id );
                            break;
                        case 'add_db':
                            DB.put( this.currentVideo );
                            break;
                        case 'del_db':
                            DB.delete( this.currentVideo.video_id );
                            break;
                        default:
                            let mylist_id = key.match( /^\d+_(.*)/ )[1];
                            let video_id = this.currentVideo.video_id;
                            // coxxx lvxxx xxx から登録
                            let additional_msg = `${NicoLiveHelper.getCommunityId()} ${NicoLiveHelper.getLiveId()} ${NicoLiveHelper.getLiveTitle()} から登録`;
                            if( options.metaKey || options.ctrlKey ){
                                additional_msg = window.prompt( 'マイリストコメントを入力してください', additional_msg );
                                additional_msg = additional_msg || '';
                            }
                            NicoLiveMylist.addMylist( mylist_id, video_id, additional_msg );
                            break;
                        }
                    },
                    items: {
                        "copy": {name: "動画IDをコピー"},
                        "add_mylist": {
                            name: "マイリストに追加",
                            items: {}
                        },
                        "sep1": "---------",
                        "add_db": {name: '動画DBに追加'},
                        "del_db": {name: '動画DBから削除'}
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
            }
        } );
    },

    init: async function(){
        let extension_info = await browser.management.getSelf();
        console.log( `New NicoLive Helper ${extension_info.version}` );
        this.version = extension_info.version;
        console.log( 'initialize nicolivehelper.' );

        /* 設定のロード */
        let result = await browser.storage.local.get( 'config' );
        console.log( 'Config loaded:' );
        MergeSimpleObject( Config, result.config );
        console.log( Config );

        browser.storage.onChanged.addListener( ( changes, area ) =>{
            if( changes.config ){
                MergeSimpleObject( Config, changes.config.newValue );
                console.log( Config );
                Twitter.init(); // 認証トークンをConfigから読ませるために
                NicoLiveRequest.loadNGVideo();
            }
        } );

        let lvid = GetParameterByName( 'lv' );
        console.log( 'lvid=' + lvid );
        if( lvid ){
            console.log( 'get liveinfo' );
            this.liveProp = await browser.runtime.sendMessage( {
                cmd: 'get-liveinfo',
                request_id: lvid
            } );
            console.log( this.liveProp );
            this.live_begintime = this.liveProp.program.beginTime;
            this.live_endtime = this.liveProp.program.endTime;
        }

        this.initUI();

        DB.initDB();
        Talker.init();
        Twitter.init();
        NicoLiveMylist.init();
        NicoLiveRequest.init();
        NicoLiveStock.init();
        NicoLiveComment.init();
        NicoLiveHistory.init();
        UserManage.init();

        if( lvid ){
            // 放送IDが渡されたら放送に接続する
            if( this.liveProp ){
                this.connectServer();
            }

            if( this.liveProp.program.providerType === 'official' ){
                $( '#community-id' ).text( 'OFFICIAL' );
            }else{
                $( '#community-id' ).text( this.liveProp.community.id );
                $( '#live-caster' ).text( this.liveProp.program.supplier.name );
            }
            $( '#live-title' ).text( this.liveProp.program.title );

            if( !this.isCaster() ){
                // コメント送信タイプを視聴者に設定
                $( '#type-of-comment' ).val( 1 );
            }
        }

        setInterval( ( ev ) =>{
            try{
                this.update();
            }catch( e ){
            }
        }, 1000 );

        this.test();
    }
};


window.addEventListener( 'load', ( ev ) =>{
    NicoLiveHelper.init();
} );

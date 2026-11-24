/* 全站中日英三语切换 + 深浅色主题（语言/主题都会记在本地） */

(function () {
    const KEY_LANG = 'site_lang';
    const KEY_THEME = 'site_theme';
    const LANGS = ['zh', 'ja', 'en'];
    const CJK = /[\u4e00-\u9fa5]/;

    let lang = 'zh';
    let applying = false;
    let observer = null;
    let timer = 0;

    /* ---------------- 词表：中文原文 → 译文（中文直接保留原文） ---------------- */
    const WORDS = {
        /* 导航与品牌 */
        '日向论坛': { en: 'Hinata Forum', ja: '日向フォーラム' },
        '逛逛': { en: 'Browse', ja: '見て回る' },
        '首页大厅': { en: 'Home', ja: 'ホーム' },
        '历史论坛': { en: 'Forum', ja: '掲示板' },
        '更新日志': { en: 'Changelog', ja: '更新履歴' },
        '工具': { en: 'Tools', ja: 'ツール' },
        'AI 助手': { en: 'AI Assistant', ja: 'AI アシスタント' },
        '格式转换': { en: 'Convert', ja: 'フォーマット変換' },
        '文档转换': { en: 'Documents', ja: 'ドキュメント変換' },
        '解压工具': { en: 'Archives', ja: '解凍ツール' },
        '翻译': { en: 'Translate', ja: '翻訳' },
        'SVC 转换': { en: 'SVC', ja: 'SVC 変換' },
        '账号': { en: 'Account', ja: 'アカウント' },
        '用户中心': { en: 'Profile', ja: 'ユーザーセンター' },
        '关于': { en: 'About', ja: '概要' },
        '关于日向论坛': { en: 'About Rixiang Forum', ja: '日向フォーラムについて' },
        '由日向个人搭建的小型社区与工具箱': { en: 'A small community & toolbox built by Rixiang', ja: '日向個人による小さなコミュニティ＆ツールボックス' },
        '⚠️ 本网站已获得工信部 ICP 备案和公安备案，请遵守相关法律法规': { en: '⚠️ This site has obtained ICP and public security registrations. Please comply with relevant laws.', ja: '⚠️ 本サイトは ICP 届出と公安届出を取得済み。関連法規を遵守してください。' },
        '关于这个网站': { en: 'About this site', ja: 'このサイトについて' },
        '原本这个网站是为一位日向特别在乎的人做的，结果做着做着……变成了我的个人网站。': { en: 'This site was originally made for someone Rixiang cares about deeply... but somehow along the way, it became my personal website.', ja: 'このサイトはもともと日向が大切にしている人のために作り始めたものですが、気づけば……私自身の個人サイトになっていました。' },
        '我把我自己及平时经常用的一些功能都加进去了，算是方便自己也方便一下其他人。后面我还会进行持续维护和更新，并且永久完全免费。': { en: 'I added features I personally use often — convenient for me, and hopefully for others too. I\'ll keep maintaining and updating it, and it will stay permanently free of charge.', ja: 'よく使う機能を詰め込みました。自分に便利で、他の人にも役立てば嬉しいです。今後もずっと無料で保守・更新し続けます。' },
        '本网站由日向个人搭建，所有功能除了 AI 对话均在浏览器内部运行，不会上传到服务器。服务器已托管到 Cloudflare。': { en: 'Built personally by Rixiang. All features except AI chat run entirely in your browser — nothing is uploaded to the server. Hosting is on Cloudflare.', ja: '日向個人が構築。AI チャットを除く全機能はブラウザ内で完結し、サーバーへはアップロードされません。サーバーは Cloudflare でホスティング。' },
        '另外由于日向本人还是个大学生，学校晚上是会熄灯断电的，所以网站的开启时间比较随缘啦～': { en: 'Also, I\'m still a college student and dorms cut power at night, so the site\'s uptime is... well, a bit random ~', ja: 'ちなみに日向はまだ大学生で、寮が夜に消灯・停電するので、サイトの稼働時間は……まあ、運ですね～' },
        'B 站主页': { en: 'Bilibili', ja: 'Bilibili ホーム' },
        '切换侧栏': { en: 'Toggle sidebar', ja: 'サイドバー切替' },
        '切换深浅色': { en: 'Toggle dark mode', ja: 'ダークモード切替' },
        '选择界面语言': { en: 'Choose language', ja: '言語を選択' },
        '拖动调整大小': { en: 'Drag to resize', ja: 'ドラッグでサイズ変更' },

        /* 首页 */
        '游客可以看帖。发帖和用户中心需要登录。': {
            en: 'Guests can read posts. Log in to publish posts or use your profile.',
            ja: 'ゲストは投稿を閲覧できます。投稿とユーザーセンターにはログインが必要です。'
        },
        '写一条帖子': { en: 'Write a post', ja: '投稿を書く' },
        '记录当下，也看看别人的近况': { en: 'Share the moment and see what others are up to', ja: '今を記録して、みんなの近況も見てみよう' },
        '问问 AI': { en: 'Ask AI', ja: 'AI に聞く' },
        '有问题直接问，记录会保存在服务器': { en: 'Ask anything; your history is saved on the server', ja: '気軽に質問。履歴はサーバーに保存されます' },
        '语音转换工具入口': { en: 'Voice conversion tool', ja: '音声変換ツールの入口' },
        '看看更新': { en: 'See updates', ja: '更新を見る' },
        '每个版本改了什么': { en: 'What changed in each version', ja: '各バージョンの変更点' },
        '最近的帖子': { en: 'Recent posts', ja: '最近の投稿' },
        '还没有帖子。': { en: 'No posts yet.', ja: 'まだ投稿がありません。' },
        '还没有帖子，去论坛写第一条吧。': { en: 'No posts yet. Be the first to post in the forum.', ja: 'まだ投稿がありません。最初の投稿を書いてみましょう。' },
        '帖子加载失败': { en: 'Failed to load posts', ja: '投稿の読み込みに失敗しました' },
        '夜深了': { en: 'It is late', ja: '夜も深まりました' },
        '早上好': { en: 'Good morning', ja: 'おはようございます' },
        '中午好': { en: 'Good afternoon', ja: 'こんにちは' },
        '下午好': { en: 'Good afternoon', ja: 'こんにちは' },
        '晚上好': { en: 'Good evening', ja: 'こんばんは' },
        '旅人': { en: 'traveler', ja: '旅人' },

        /* 论坛 */
        '想说点什么...': { en: 'Say something...', ja: '何か書いてみましょう...' },
        '发布': { en: 'Publish', ja: '投稿する' },
        '请先登录才能发帖': { en: 'Please log in to publish a post', ja: '投稿するにはログインしてください' },
        '内容不能为空': { en: 'Content cannot be empty', ja: '内容を入力してください' },
        '发布失败': { en: 'Failed to publish', ja: '投稿に失敗しました' },
        '发布失败，请检查网络': { en: 'Failed to publish. Check your network.', ja: '投稿に失敗しました。通信を確認してください' },

        /* AI 聊天 */
        '登录后可保存聊天记录': { en: 'Log in to save chat history', ja: 'ログインするとチャット履歴を保存できます' },
        '清空记录': { en: 'Clear history', ja: '履歴を消去' },
        '输入问题，回车发送': { en: 'Type a question and press Enter', ja: '質問を入力して Enter で送信' },
        '发送': { en: 'Send', ja: '送信' },
        '有什么想聊的，直接说就好。': { en: 'Feel free to ask anything.', ja: '何でも気軽に話しかけてください。' },
        '登录后聊天记录会保存在服务器，下次登录可以接着聊。': {
            en: 'Chat history is saved to the server after login, so you can continue next time.',
            ja: 'ログインすると履歴がサーバーに保存され、次回も続きから話せます。'
        },
        '去登录': { en: 'Log in', ja: 'ログイン' },
        '正在想...': { en: 'Thinking...', ja: '考え中...' },
        '登录后才能使用 AI，并把聊天记录保存到服务器': {
            en: 'Log in to use the AI and save chat history on the server',
            ja: 'AI の利用と履歴の保存にはログインが必要です'
        },
        '确定清空全部聊天记录吗？当日额度不会恢复。': {
            en: 'Clear all chat history? Today\u2019s quota will not be restored.',
            ja: 'すべての履歴を消去しますか？本日の利用枠は戻りません。'
        },
        '清空失败': { en: 'Failed to clear history', ja: '履歴の消去に失敗しました' },
        '清空失败，请检查网络': { en: 'Failed to clear history. Check your network.', ja: '履歴の消去に失敗しました。通信を確認してください' },
        '请求失败': { en: 'Request failed', ja: 'リクエストに失敗しました' },
        '网络请求失败，请稍后再试': { en: 'Network error. Please try again later.', ja: '通信に失敗しました。しばらくしてから再試行してください' },

        /* 格式转换 */
        '全部在浏览器本地完成，文件不会上传服务器': {
            en: 'Everything runs locally in your browser; files are never uploaded',
            ja: 'すべてブラウザ内で処理され、ファイルはサーバーに送信されません'
        },
        '提取 / 转音频': { en: 'Extract audio', ja: '音声を抽出' },
        '转换视频': { en: 'Convert video', ja: '動画を変換' },
        '视频截图': { en: 'Video frame', ja: '動画フレーム' },
        '点击选择文件，或把音视频拖到这里': { en: 'Click to choose a file, or drop audio/video here', ja: 'ファイルを選択、または音声・動画をここにドロップ' },
        '常见 MP4 / MOV / MKV / WEBM / AVI / MP3 / WAV / FLAC / OGG / M4A 都可以': {
            en: 'MP4 / MOV / MKV / WEBM / AVI / MP3 / WAV / FLAC / OGG / M4A are supported',
            ja: 'MP4 / MOV / MKV / WEBM / AVI / MP3 / WAV / FLAC / OGG / M4A に対応'
        },
        '输出格式': { en: 'Output format', ja: '出力形式' },
        '质量': { en: 'Quality', ja: '品質' },
        '高质量（文件更大）': { en: 'High quality (larger file)', ja: '高画質（ファイル大）' },
        '标准': { en: 'Standard', ja: '標準' },
        '小体积': { en: 'Small size', ja: '小サイズ' },
        '高质量': { en: 'High quality', ja: '高画質' },
        '转换在浏览器本地完成，文件不会上传；首次使用需要加载约 32MB 的转换引擎。': {
            en: 'Conversion runs locally in your browser and files are never uploaded. First use loads a ~32MB engine.',
            ja: '変換はブラウザ内で行われ、ファイルは送信されません。初回は約 32MB のエンジンを読み込みます。'
        },
        '开始转换': { en: 'Start conversion', ja: '変換を開始' },
        '图片格式': { en: 'Image format', ja: '画像形式' },
        'PNG（无损）': { en: 'PNG (lossless)', ja: 'PNG（可逆）' },
        'JPG': { en: 'JPG', ja: 'JPG' },
        '截取当前帧': { en: 'Capture current frame', ja: '現在のフレームを保存' },
        '拖动进度条选好画面后点「截取当前帧」，导出的是视频原始分辨率的图片。': {
            en: 'Drag the slider to pick a frame, then click "Capture current frame". The image is exported at the video\u2019s original resolution.',
            ja: 'スライダーで画面を選び「現在のフレームを保存」を押すと、元の解像度で書き出します。'
        },
        '点击选择视频，或把视频拖到这里': { en: 'Click to choose a video, or drop it here', ja: '動画を選択、またはここにドロップ' },
        '支持 MP4 / MOV / WEBM / MKV 等浏览器能播放的格式': { en: 'Supports browser-playable formats such as MP4 / MOV / WEBM / MKV', ja: 'ブラウザで再生できる MP4 / MOV / WEBM / MKV などに対応' },
        '选择视频后，在时间轴上选一帧截图。': { en: 'Choose a video, then pick a frame on the timeline.', ja: '動画を選び、タイムラインでフレームを選択してください。' },
        '拖动进度条选择画面后点「截取当前帧」。': { en: 'Drag the slider, then click "Capture current frame".', ja: 'スライダーで画面を選び「現在のフレームを保存」を押してください。' },
        '正在读取视频信息…': { en: 'Reading video info...', ja: '動画情報を読み込み中...' },
        '这个视频浏览器无法解码，换一个 MP4 / WEBM 文件试试。': { en: 'Your browser cannot decode this video. Try an MP4 / WEBM file.', ja: 'この動画はブラウザで再生できません。MP4 / WEBM をお試しください。' },
        '视频还没准备好，请稍等一下。': { en: 'The video is not ready yet. Please wait a moment.', ja: '動画の準備ができていません。少しお待ちください。' },
        '截图失败，换一个视频再试试。': { en: 'Capture failed. Try another video.', ja: 'キャプチャに失敗しました。別の動画でお試しください。' },
        '截图完成，点击右侧「下载」保存。': { en: 'Frame captured. Click "Download" on the right to save.', ja: '保存しました。右側の「ダウンロード」から保存してください。' },
        '下载': { en: 'Download', ja: 'ダウンロード' },
        '换一个': { en: 'Choose another', ja: '別のファイル' },
        '转换中…': { en: 'Converting...', ja: '変換中...' },
        '正在加载转换引擎，约 32MB，请保持页面打开…': { en: 'Loading conversion engine (~32MB). Keep this page open...', ja: '変換エンジン（約 32MB）を読み込み中。ページを閉じないでください...' },
        '引擎已就绪，可以开始转换了。': { en: 'Engine ready. You can start converting.', ja: 'エンジンの準備ができました。変換を開始できます。' },
        '引擎已就绪，选择文件后即可开始转换。': { en: 'Engine ready. Choose a file to start converting.', ja: 'エンジンの準備ができました。ファイルを選んで変換を開始できます。' },
        '转换引擎加载失败，请检查网络后重试。': { en: 'Failed to load the conversion engine. Check your network and retry.', ja: '変換エンジンの読み込みに失敗しました。通信を確認して再試行してください。' },
        '正在读取文件…': { en: 'Reading file...', ja: 'ファイルを読み込み中...' },
        '正在转换，视频较大时需要等一会儿，请不要关闭页面…': { en: 'Converting. Large videos take a while; please do not close the page...', ja: '変換中です。大きな動画は時間がかかるため、ページを閉じないでください...' },
        '正在生成下载文件…': { en: 'Preparing download...', ja: 'ダウンロードファイルを生成中...' },
        '转换完成，点击下方按钮保存文件。': { en: 'Done. Click the button below to save the file.', ja: '変換完了。下のボタンからファイルを保存してください。' },
        '转换失败：': { en: 'Conversion failed: ', ja: '変換に失敗しました：' },
        '未知错误': { en: 'unknown error', ja: '不明なエラー' },
        '文件超过 800MB，浏览器内存可能不够，建议先裁剪或压缩后再试。': {
            en: 'The file exceeds 800MB; the browser may run out of memory. Trim or compress it first.',
            ja: 'ファイルが 800MB を超えています。ブラウザのメモリが不足する可能性があるため、事前に分割・圧縮してください。'
        },
        'MP4（H.264）': { en: 'MP4 (H.264)', ja: 'MP4（H.264）' },
        'MOV（H.264）': { en: 'MOV (H.264)', ja: 'MOV（H.264）' },
        'WEBM（VP8）': { en: 'WEBM (VP8)', ja: 'WEBM（VP8）' },
        'MKV（直接封装）': { en: 'MKV (remux)', ja: 'MKV（そのまま格納）' },
        'AVI（MPEG-4）': { en: 'AVI (MPEG-4)', ja: 'AVI（MPEG-4）' },
        'GIF（无声动图）': { en: 'GIF (silent animation)', ja: 'GIF（無音アニメ）' },
        'OGG（Vorbis）': { en: 'OGG (Vorbis)', ja: 'OGG（Vorbis）' },
        'M4A（AAC）': { en: 'M4A (AAC)', ja: 'M4A（AAC）' },

        /* 文档转换 */
        '文档与图片转换': { en: 'Documents & images', ja: 'ドキュメントと画像の変換' },
        '图片 → PDF': { en: 'Images → PDF', ja: '画像 → PDF' },
        'PDF → 图片': { en: 'PDF → Images', ja: 'PDF → 画像' },
        '文档 → PDF': { en: 'Documents → PDF', ja: '文書 → PDF' },
        'PDF → 文本': { en: 'PDF → Text', ja: 'PDF → テキスト' },
        '点击选择图片，或拖到这里': { en: 'Click to choose images, or drop them here', ja: '画像を選択、またはここにドロップ' },
        '支持 PNG / JPG / JPEG / WEBP / GIF / BMP': { en: 'Supports PNG / JPG / JPEG / WEBP / GIF / BMP', ja: 'PNG / JPG / JPEG / WEBP / GIF / BMP に対応' },
        '选择一张或多张图片，合成 PDF': { en: 'Choose one or more images to combine into a PDF', ja: '1 枚以上の画像を選んで PDF にまとめる' },
        '多张图片会按选择顺序各占一页': { en: 'Each image becomes one page, in the order selected', ja: '複数の画像は選択順に 1 ページずつ配置されます' },
        '点击选择 PDF 文件，或拖到这里': { en: 'Click to choose a PDF, or drop it here', ja: 'PDF を選択、またはここにドロップ' },
        '每一页会导出成一张图片': { en: 'Each page is exported as an image', ja: '各ページを画像として書き出します' },
        '选择文档，转成 PDF': { en: 'Choose a document to convert to PDF', ja: '文書を選んで PDF に変換' },
        '支持 TXT / Markdown / HTML / DOCX': { en: 'Supports TXT / Markdown / HTML / DOCX', ja: 'TXT / Markdown / HTML / DOCX に対応' },
        '选择 PDF，导出纯文本': { en: 'Choose a PDF to export as plain text', ja: 'PDF を選んでテキストを書き出す' },
        '按页提取文字，图片型 PDF 无法识别': { en: 'Extracts text page by page; image-only PDFs are not supported', ja: 'ページごとに文字を抽出。画像のみの PDF は非対応です' },
        'A4 纸张': { en: 'A4 paper', ja: 'A4 用紙' },
        '按图片尺寸': { en: 'Image size', ja: '画像サイズ' },
        'TXT 纯文本': { en: 'TXT plain text', ja: 'TXT テキスト' },
        '页面尺寸': { en: 'Page size', ja: 'ページサイズ' },
        '导出格式': { en: 'Export format', ja: '出力形式' },
        '重选': { en: 'Choose again', ja: '選び直す' },
        '文件会在浏览器本地处理，不会上传服务器。': { en: 'Files are processed locally and never uploaded.', ja: 'ファイルはブラウザ内で処理され、サーバーには送信されません。' },
        '已选择文件，点「开始转换」。': { en: 'File selected. Click "Start conversion".', ja: 'ファイルを選択しました。「変換を開始」を押してください。' },
        '转换完成，点击右侧按钮下载。': { en: 'Done. Click the button on the right to download.', ja: '変換完了。右側のボタンからダウンロードしてください。' },
        'PDF 已生成，点击右侧按钮下载。': { en: 'PDF created. Click the button on the right to download.', ja: 'PDF を作成しました。右側のボタンからダウンロードしてください。' },
        '提取完成。图片型 PDF 没有文字层，结果可能为空。': { en: 'Extraction complete. Image-only PDFs have no text layer, so results may be empty.', ja: '抽出完了。画像のみの PDF にはテキスト層がないため、結果が空の場合があります。' },
        '正在排版文档…': { en: 'Laying out the document...', ja: '文書をレイアウト中...' },
        '正在生成页面图片…': { en: 'Rendering pages...', ja: 'ページ画像を生成中...' },
        '处理中…': { en: 'Processing...', ja: '処理中...' },
        '处理失败：': { en: 'Processing failed: ', ja: '処理に失敗しました：' },
        '浏览器无法解码相机 RAW（.cr2 / .nef / .arw），请先导出为 JPG 或 TIFF 再转换。': {
            en: 'Browsers cannot decode camera RAW (.cr2 / .nef / .arw). Export to JPG or TIFF first.',
            ja: 'ブラウザはカメラ RAW（.cr2 / .nef / .arw）を扱えません。JPG か TIFF に書き出してから変換してください。'
        },

        /* 解压工具 */
        '全部在浏览器本地解压，文件不会上传服务器': { en: 'All extraction happens locally; files are never uploaded', ja: 'すべてブラウザ内で解凍され、ファイルはサーバーに送信されません' },
        '压缩包': { en: 'Archives', ja: '圧縮ファイル' },
        '光盘 / 镜像': { en: 'Disc / image', ja: 'ディスク・イメージ' },
        '应用与软件包': { en: 'Apps & packages', ja: 'アプリ・パッケージ' },
        '点击选择文件，或拖到这里': { en: 'Click to choose a file, or drop it here', ja: 'ファイルを選択、またはここにドロップ' },
        '选择一个文件，或直接拖进来；没选格式时按内容自动识别': { en: 'Choose a file or drop it in; the format is detected from content', ja: 'ファイルを選択するかドロップしてください。形式は内容から自動判別します' },
        '解压密码': { en: 'Password', ja: 'パスワード' },
        '加密压缩包才需要填写': { en: 'Only for encrypted archives', ja: '暗号化された圧縮ファイルのみ入力' },
        '文件会在浏览器本地解压，不会上传服务器。': { en: 'Files are extracted locally and never uploaded.', ja: 'ファイルはブラウザ内で解凍され、サーバーには送信されません。' },
        '开始解压': { en: 'Start extraction', ja: '解凍を開始' },
        '支持 ZIP / JAR / WAR / APK / IPA / TAR / TAR.GZ / TGZ / GZ / 7Z / RAR / CAB / ISO / IMG / BIN / DEB / RPM / XAR 等。VDI / VMDK / VHD / VHDX / QCOW2 / DMG / WIM 是磁盘镜像，浏览器无法直接解析。': {
            en: 'Supports ZIP / JAR / WAR / APK / IPA / TAR / TAR.GZ / TGZ / GZ / 7Z / RAR / CAB / ISO / IMG / BIN / DEB / RPM / XAR and more. VDI / VMDK / VHD / VHDX / QCOW2 / DMG / WIM are disk images that browsers cannot parse.',
            ja: 'ZIP / JAR / WAR / APK / IPA / TAR / TAR.GZ / TGZ / GZ / 7Z / RAR / CAB / ISO / IMG / BIN / DEB / RPM / XAR などに対応。VDI / VMDK / VHD / VHDX / QCOW2 / DMG / WIM はディスクイメージのため、ブラウザでは解析できません。'
        },
        '解压 ZIP': { en: 'Extract ZIP', ja: 'ZIP を解凍' },
        '常见的 ZIP 压缩包，含 DOCX / XLSX / EPUB': { en: 'Common ZIP archives, including DOCX / XLSX / EPUB', ja: '一般的な ZIP。DOCX / XLSX / EPUB も含む' },
        '解压 JAR / WAR': { en: 'Extract JAR / WAR', ja: 'JAR / WAR を解凍' },
        'Java 应用包，本质是 ZIP 结构': { en: 'Java application packages (ZIP structure)', ja: 'Java アプリのパッケージ（実体は ZIP）' },
        '解压 TAR': { en: 'Extract TAR', ja: 'TAR を解凍' },
        '保留目录结构展开 tar 归档': { en: 'Extracts tar archives preserving directories', ja: 'ディレクトリ構造を保って展開' },
        '解压 TAR.GZ / TGZ': { en: 'Extract TAR.GZ / TGZ', ja: 'TAR.GZ / TGZ を解凍' },
        '先解 gzip，再展开里面的 tar': { en: 'Decompress gzip, then unpack the tar', ja: 'gzip を解いて中の tar を展開' },
        '解压 7Z': { en: 'Extract 7Z', ja: '7Z を解凍' },
        '读取 7z 压缩包，支持加密包': { en: 'Reads 7z archives, including encrypted ones', ja: '7z を読み取り（暗号化にも対応）' },
        '解压 RAR': { en: 'Extract RAR', ja: 'RAR を解凍' },
        '支持 RAR / RAR5 压缩包': { en: 'Supports RAR / RAR5 archives', ja: 'RAR / RAR5 に対応' },
        '解压 CAB': { en: 'Extract CAB', ja: 'CAB を解凍' },
        'Windows 安装包里的 cabinet 归档': { en: 'Cabinet archives from Windows installers', ja: 'Windows インストーラの cabinet アーカイブ' },
        '自动识别': { en: 'Auto detect', ja: '自動判別' },
        '不确定格式就选这个，按内容自动判断': { en: 'Pick this if unsure; the format is detected from content', ja: '形式が不明ならこれを選択。内容から自動判別します' },
        '打开 ISO': { en: 'Open ISO', ja: 'ISO を開く' },
        '浏览并提取 ISO 9660 光盘镜像': { en: 'Browse and extract ISO 9660 disc images', ja: 'ISO 9660 ディスクイメージを閲覧・抽出' },
        '打开 IMG / BIN': { en: 'Open IMG / BIN', ja: 'IMG / BIN を開く' },
        '标准 ISO 9660 的 img / bin 镜像可用': { en: 'Works with standard ISO 9660 img / bin images', ja: '標準的な ISO 9660 の img / bin に対応' },
        '打开 APK': { en: 'Open APK', ja: 'APK を開く' },
        '提取安卓安装包里的文件': { en: 'Extract files from Android packages', ja: 'Android パッケージ内のファイルを抽出' },
        '打开 IPA': { en: 'Open IPA', ja: 'IPA を開く' },
        '提取 iOS 应用包里的文件': { en: 'Extract files from iOS app packages', ja: 'iOS アプリパッケージ内のファイルを抽出' },
        '打开 DEB': { en: 'Open DEB', ja: 'DEB を開く' },
        'Debian 软件包（ar 归档结构）': { en: 'Debian packages (ar archive)', ja: 'Debian パッケージ（ar アーカイブ）' },
        '打开 RPM': { en: 'Open RPM', ja: 'RPM を開く' },
        '浏览 RPM 软件包内容': { en: 'Browse RPM package contents', ja: 'RPM パッケージの内容を閲覧' },
        '打开 XAR / PKG': { en: 'Open XAR / PKG', ja: 'XAR / PKG を開く' },
        'macOS 安装包归档': { en: 'macOS installer archives', ja: 'macOS インストーラのアーカイブ' },
        '解压中': { en: 'Extracting', ja: '解凍中' },
        '解压中…': { en: 'Extracting...', ja: '解凍中...' },
        '已下载': { en: 'Downloaded', ja: 'ダウンロード済み' },
        '失败': { en: 'Failed', ja: '失敗' },
        '正在加载解压引擎…': { en: 'Loading extraction engine...', ja: '解凍エンジンを読み込み中...' },
        '正在读取压缩包…': { en: 'Reading archive...', ja: '圧縮ファイルを読み込み中...' },
        '这个压缩包已加密，请填写密码后再点「开始解压」。': { en: 'This archive is encrypted. Enter the password, then click "Start extraction".', ja: 'この圧縮ファイルは暗号化されています。パスワードを入力して「解凍を開始」を押してください。' },
        '没有读到可解压的文件，可能是空包或格式不被支持。': { en: 'No extractable files found. The archive may be empty or unsupported.', ja: '解凍できるファイルがありません。空か未対応の形式かもしれません。' },
        '解压失败：压缩包已加密，请填写密码后重试。': { en: 'Extraction failed: the archive is encrypted. Enter the password and retry.', ja: '解凍失敗：暗号化されています。パスワードを入力して再試行してください。' },
        '解压失败：': { en: 'Extraction failed: ', ja: '解凍に失敗しました：' },
        '（该格式可能不被支持）': { en: ' (this format may be unsupported)', ja: '（この形式は未対応の可能性があります）' },
        '正在读取全部文件…': { en: 'Reading all files...', ja: 'すべてのファイルを読み込み中...' },
        '已打包完成，浏览器开始下载。': { en: 'Packaging complete. Your browser is downloading.', ja: 'パッケージ化完了。ダウンロードが始まります。' },
        '打包失败：': { en: 'Packaging failed: ', ja: 'パッケージ化に失敗しました：' },

        /* 翻译页 */
        '由站内 AI 完成翻译，内容只用于本次结果，不会保存': { en: 'Translated by the site AI. Content is used only for this result and is never saved', ja: 'サイト内 AI が翻訳します。内容は今回の結果にのみ使用され、保存されません' },
        '源语言': { en: 'Source language', ja: '原文の言語' },
        '交换语言': { en: 'Swap languages', ja: '言語を入れ替え' },
        '目标语言': { en: 'Target language', ja: '訳先の言語' },
        '输入要翻译的内容，Ctrl + Enter 也可以直接翻译': { en: 'Enter text to translate. Ctrl + Enter also works', ja: '翻訳する内容を入力。Ctrl + Enter でも翻訳できます' },
        '译文会显示在这里': { en: 'The translation appears here', ja: '訳文がここに表示されます' },
        '复制译文': { en: 'Copy translation', ja: '訳文をコピー' },
        '支持中文、英语、日语、韩语、法语、德语、俄语等常用语言互译。': { en: 'Supports translation among Chinese, English, Japanese, Korean, French, German, Russian and more.', ja: '中国語・英語・日本語・韓国語・フランス語・ドイツ語・ロシア語などの相互翻訳に対応。' },
        '开始翻译': { en: 'Translate', ja: '翻訳する' },
        '翻译中…': { en: 'Translating...', ja: '翻訳中...' },
        '正在翻译，稍等一下…': { en: 'Translating. One moment...', ja: '翻訳中です。少々お待ちください...' },
        '翻译完成。': { en: 'Translation complete.', ja: '翻訳が完了しました。' },
        '翻译失败，请稍后再试。': { en: 'Translation failed. Please try again later.', ja: '翻訳に失敗しました。しばらくしてから再試行してください。' },
        '已交换源语言和目标语言。': { en: 'Swapped source and target languages.', ja: '原文と訳先の言語を入れ替えました。' },
        '先在左边输入要翻译的内容。': { en: 'Enter the text to translate on the left first.', ja: '左側に翻訳する内容を入力してください。' },
        '源语言和目标语言相同，已直接填入原文。': { en: 'Source and target are the same; the original text was copied.', ja: '原文と訳先が同じため、原文をそのまま入力しました。' },
        '还没有译文可以复制。': { en: 'There is no translation to copy yet.', ja: 'コピーできる訳文がまだありません。' },
        '译文已复制。': { en: 'Translation copied.', ja: '訳文をコピーしました。' },
        '复制失败，请手动选中复制。': { en: 'Copy failed. Please select and copy manually.', ja: 'コピーに失敗しました。手動で選択してコピーしてください。' },
        '内容太长了，请控制在 4000 字以内。': { en: 'The text is too long. Keep it under 4000 characters.', ja: '内容が長すぎます。4000 文字以内にしてください。' },
        '自动检测': { en: 'Auto detect', ja: '自動検出' },
        '中文': { en: 'Chinese', ja: '中国語' },
        '英语': { en: 'English', ja: '英語' },
        '日语': { en: 'Japanese', ja: '日本語' },
        '韩语': { en: 'Korean', ja: '韓国語' },
        '法语': { en: 'French', ja: 'フランス語' },
        '德语': { en: 'German', ja: 'ドイツ語' },
        '西班牙语': { en: 'Spanish', ja: 'スペイン語' },
        '俄语': { en: 'Russian', ja: 'ロシア語' },
        '葡萄牙语': { en: 'Portuguese', ja: 'ポルトガル語' },
        '意大利语': { en: 'Italian', ja: 'イタリア語' },
        '阿拉伯语': { en: 'Arabic', ja: 'アラビア語' },
        '泰语': { en: 'Thai', ja: 'タイ語' },

        /* 账号 / 用户中心 */
        '密码登录': { en: 'Password login', ja: 'パスワードでログイン' },
        '验证码登录': { en: 'Code login', ja: '認証コードでログイン' },
        '注册': { en: 'Register', ja: '登録' },
        '用户名': { en: 'Username', ja: 'ユーザー名' },
        '密码': { en: 'Password', ja: 'パスワード' },
        '登录': { en: 'Log in', ja: 'ログイン' },
        '注册时的邮箱': { en: 'Email used at registration', ja: '登録時のメールアドレス' },
        '6位验证码': { en: '6-digit code', ja: '6 桁のコード' },
        '6 位验证码': { en: '6-digit code', ja: '6 桁のコード' },
        '获取验证码': { en: 'Get code', ja: 'コードを取得' },
        '密码（至少 6 位）': { en: 'Password (at least 6 characters)', ja: 'パスワード（6 文字以上）' },
        '邮箱': { en: 'Email', ja: 'メールアドレス' },
        '点击上传': { en: 'Click to upload', ja: 'クリックでアップロード' },
        '发帖': { en: 'Posts', ja: '投稿' },
        '今日 AI': { en: 'AI today', ja: '本日の AI' },
        '个人资料': { en: 'Profile', ja: 'プロフィール' },
        '个性签名': { en: 'Signature', ja: 'ひとこと' },
        '介绍一下自己吧...': { en: 'Introduce yourself...', ja: '自己紹介を書いてみましょう...' },
        '生日': { en: 'Birthday', ja: '誕生日' },
        '头像点左上角圆形区域上传，会自动裁成正方形。': { en: 'Click the circle at the top left to upload an avatar; it is cropped to a square automatically.', ja: '左上の丸い部分をクリックしてアバターをアップロードします。自動で正方形に切り抜かれます。' },
        '保存资料': { en: 'Save profile', ja: 'プロフィールを保存' },
        '今日 AI 额度': { en: 'Today\u2019s AI quota', ja: '本日の AI 利用枠' },
        '条': { en: '', ja: '件' },
        '每天 0 点重置，聊天记录会自动保存。': { en: 'Resets at midnight; chat history is saved automatically.', ja: '毎日 0 時にリセットされ、履歴は自動保存されます。' },
        '更换绑定邮箱': { en: 'Change email', ja: 'メールアドレス変更' },
        '验证码会发送到新邮箱，收不到就翻一下垃圾箱。': { en: 'The code is sent to the new email. Check your spam folder if you do not see it.', ja: '認証コードは新しいメールに送信されます。届かない場合は迷惑メールもご確認ください。' },
        '新邮箱': { en: 'New email', ja: '新しいメールアドレス' },
        '绑定': { en: 'Bind', ja: '登録' },
        '修改密码': { en: 'Change password', ja: 'パスワード変更' },
        '当前密码': { en: 'Current password', ja: '現在のパスワード' },
        '新密码（至少 6 位）': { en: 'New password (at least 6 characters)', ja: '新しいパスワード（6 文字以上）' },
        '注销账号': { en: 'Delete account', ja: 'アカウント削除' },
        '注销后账号、帖子和聊天记录都会删除，不能恢复。请输入用户名确认。': { en: 'Your account, posts and chat history will be deleted permanently. Enter your username to confirm.', ja: 'アカウント・投稿・履歴はすべて削除され、元に戻せません。確認のためユーザー名を入力してください。' },
        '输入用户名': { en: 'Enter username', ja: 'ユーザー名を入力' },
        '未登录': { en: 'Guest', ja: 'ゲスト' },
        '登录 / 注册': { en: 'Log in / Register', ja: 'ログイン / 登録' },
        '退出': { en: 'Log out', ja: 'ログアウト' },
        '加入于': { en: 'Joined', ja: '登録日' },
        '绑定邮箱：': { en: 'Email: ', ja: 'メール：' },
        '未绑定': { en: 'Not bound', ja: '未登録' },
        '用户名密码注册与登录': { en: 'Username and password registration and login', ja: 'ユーザー名とパスワードで登録・ログイン' },

        /* 账号提示 */
        '请填写完整': { en: 'Please fill in all fields', ja: 'すべて入力してください' },
        '请填写完整信息': { en: 'Please fill in all the information', ja: 'すべての項目を入力してください' },
        '登录失败': { en: 'Login failed', ja: 'ログインに失敗しました' },
        '注册失败': { en: 'Registration failed', ja: '登録に失敗しました' },
        '注册成功，请用密码登录': { en: 'Registered. Please log in with your password.', ja: '登録しました。パスワードでログインしてください。' },
        '网络请求失败': { en: 'Network error', ja: '通信に失敗しました' },
        '发送中...': { en: 'Sending...', ja: '送信中...' },
        '验证码已发送': { en: 'Verification code sent', ja: '認証コードを送信しました' },
        '发送失败': { en: 'Failed to send', ja: '送信に失敗しました' },
        '请先填写邮箱': { en: 'Please enter your email first', ja: '先にメールアドレスを入力してください' },
        '保存成功': { en: 'Saved', ja: '保存しました' },
        '保存失败，请检查网络': { en: 'Failed to save. Check your network.', ja: '保存に失敗しました。通信を確認してください' },
        '请输入当前用户名以确认注销': { en: 'Enter your current username to confirm deletion', ja: '削除の確認のため現在のユーザー名を入力してください' },
        '注销后账号和你的帖子都会删除，且不能恢复。确定继续？': { en: 'Your account and posts will be deleted permanently. Continue?', ja: 'アカウントと投稿は削除され、元に戻せません。続行しますか？' },
        '账号已注销': { en: 'Account deleted', ja: 'アカウントを削除しました' },
        '注销失败': { en: 'Failed to delete account', ja: 'アカウントの削除に失敗しました' },
        '注销失败，请检查网络': { en: 'Failed to delete account. Check your network.', ja: 'アカウントの削除に失敗しました。通信を確認してください' },
        '请填写新邮箱和验证码': { en: 'Please enter the new email and code', ja: '新しいメールアドレスと認証コードを入力してください' },
        '绑定失败': { en: 'Failed to bind', ja: '登録に失敗しました' },
        '绑定失败，请检查网络': { en: 'Failed to bind. Check your network.', ja: '登録に失敗しました。通信を確認してください' },
        '邮箱已更新': { en: 'Email updated', ja: 'メールアドレスを更新しました' },
        '请填写当前密码和新密码': { en: 'Please enter the current and new passwords', ja: '現在のパスワードと新しいパスワードを入力してください' },
        '新密码至少 6 位': { en: 'The new password must be at least 6 characters', ja: '新しいパスワードは 6 文字以上にしてください' },
        '修改失败': { en: 'Failed to change', ja: '変更に失敗しました' },
        '修改失败，请检查网络': { en: 'Failed to change. Check your network.', ja: '変更に失敗しました。通信を確認してください' },
        '密码已修改，请用新密码重新登录': { en: 'Password changed. Please log in again with the new password.', ja: 'パスワードを変更しました。新しいパスワードで再ログインしてください。' },
        '登录已过期，请重新登录': { en: 'Session expired. Please log in again.', ja: 'ログインの有効期限が切れました。再度ログインしてください。' },
        '加载失败': { en: 'Failed to load', ja: '読み込みに失敗しました' },
        '网络请求失败，请检查后端是否启动': { en: 'Network error. Check whether the server is running.', ja: '通信に失敗しました。サーバーが起動しているか確認してください。' },
        '分配失败，请刷新': { en: 'Assignment failed. Please refresh.', ja: '割り当てに失敗しました。再読み込みしてください。' },
        '这张图片无法裁切': { en: 'This image cannot be cropped', ja: 'この画像は切り抜けません' },
        '用中间这一块做头像': { en: 'Use the center area as your avatar', ja: '中央の範囲をアバターにします' },
        '取消': { en: 'Cancel', ja: 'キャンセル' },
        '就用这张': { en: 'Use this one', ja: 'これを使う' },

        /* 页脚 */
        '举报请联系网站管理员': { en: 'Contact the site administrator to report issues', ja: '通報はサイト管理者までご連絡ください' },
        '联系邮箱：': { en: 'Contact email: ', ja: '連絡先メール：' },
        '本网站已通过ICP备案，备案码：': { en: 'ICP filing number: ', ja: 'ICP 登録番号：' },

        /* 更新日志标签 */
        '最新': { en: 'Latest', ja: '最新' },
        '新增': { en: 'New', ja: '新機能' },
        '说明': { en: 'Note', ja: '説明' },
        '修复': { en: 'Fix', ja: '修正' },
        '调整': { en: 'Tweak', ja: '調整' },
        '清理': { en: 'Cleanup', ja: '整理' },
        '优化': { en: 'Improve', ja: '改善' },
        '首发': { en: 'Release', ja: '初版' }
    };

    /* 更新日志正文 */
    const LOG_WORDS = {
        '2026年11月23日': { en: 'Nov 23, 2026', ja: '2026年11月23日' },
        '2026年11月22日': { en: 'Nov 22, 2026', ja: '2026年11月22日' },
        '2026年11月5日': { en: 'Nov 5, 2026', ja: '2026年11月5日' },
        '2026年11月1日': { en: 'Nov 1, 2026', ja: '2026年11月1日' },

        '左上角新增深浅色切换按钮，太阳 / 月亮图标一键切换，选择会记录在本地。': {
            en: 'Added a light/dark switch in the top left: one click on the sun/moon icon, and your choice is remembered locally.',
            ja: '左上にライト／ダーク切替ボタンを追加。太陽／月アイコンをワンクリックで切り替えでき、選択はローカルに保存されます。'
        },
        '左上角新增语言选择，界面支持中文、日语、英语三种语言互换。': {
            en: 'Added a language selector in the top left; the interface supports Chinese, Japanese and English.',
            ja: '左上に言語選択を追加。中国語・日本語・英語の 3 言語に対応しました。'
        },
        '语言与主题只影响界面显示，不会改变帖子、聊天记录等已有内容。': {
            en: 'Language and theme only affect the interface; existing posts and chat history stay unchanged.',
            ja: '言語とテーマは表示のみに影響し、投稿やチャット履歴などの既存内容は変更されません。'
        },
        '格式转换新增「视频截图」：上传视频后拖动时间轴选一帧，导出原始分辨率的 PNG / JPG，全程本地完成。': {
            en: 'New "Video frame" mode in Convert: upload a video, drag the timeline to pick a frame, and export a PNG / JPG at the original resolution, all locally.',
            ja: 'フォーマット変換に「動画フレーム」を追加。動画を読み込み、タイムラインでフレームを選んで元の解像度の PNG / JPG を書き出せます（すべてローカル処理）。'
        },
        '左侧工具栏新增「翻译」：支持中文、英语、日语、韩语等 12 种语言互译，可一键交换语言、复制译文。': {
            en: 'New "Translate" tool in the sidebar: translate among 12 languages including Chinese, English, Japanese and Korean, with one-click language swap and copy.',
            ja: '左側ツールバーに「翻訳」を追加。中国語・英語・日本語・韓国語など 12 言語の相互翻訳に対応し、言語の入れ替えや訳文のコピーもワンクリックで可能です。'
        },
        '翻译由站内 AI 完成，内容只用于本次结果，不会存进聊天记录。': {
            en: 'Translation is handled by the site AI; content is used only for the result and never stored in chat history.',
            ja: '翻訳はサイト内 AI が行い、内容は今回の結果にのみ使用され、チャット履歴には保存されません。'
        },
        '吉祥物可以按住拖到任意位置，拖动左上角圆点可缩放大小。': {
            en: 'The mascot can be dragged anywhere; drag the dot at its top left to resize it.',
            ja: 'マスコットは任意の位置にドラッグでき、左上の丸をドラッグしてサイズを変更できます。'
        },
        '位置和大小会保存在本地，刷新页面后保持；去掉「点我一下」气泡。': {
            en: 'Position and size are saved locally and kept after refresh; the "tap me" bubble was removed.',
            ja: '位置とサイズはローカルに保存され、再読み込み後も維持されます。「タップしてね」の吹き出しは削除しました。'
        },
        '拖动超过几个像素算移动，轻点仍然是切换动作，不会误触。': {
            en: 'Dragging more than a few pixels counts as moving; a light tap still switches actions without misfires.',
            ja: '数ピクセル以上のドラッグは移動として扱い、軽いタップはこれまで通り動作切替になり、誤操作しません。'
        },
        '右下角 Live2D 吉祥物「梅娅」：待机时自己小幅呼吸摆动。': {
            en: 'New Live2D mascot "Meya" in the bottom right, gently breathing and swaying while idle.',
            ja: '右下に Live2D マスコット「メイヤ」を追加。待機中は小さく呼吸するように揺れます。'
        },
        '点击吉祥物会做幅度更大的动作，并在「眯眼」「生气」两种表情之间切换。': {
            en: 'Clicking the mascot triggers a bigger motion and switches between "squinting" and "angry" expressions.',
            ja: 'マスコットをクリックすると大きなモーションを行い、「目を細める」「怒る」の 2 つの表情を切り替えます。'
        },
        '全站配色改为与梅娅一致的奶油粉、玫瑰粉与淡紫灰，侧栏改为深梅子色。': {
            en: 'The whole site now uses cream pink, rose pink and soft lilac gray to match Meya, with a deep plum sidebar.',
            ja: 'サイト全体の配色をメイヤに合わせたクリームピンク・ローズピンク・淡いライラックグレーに変更し、サイドバーは深いプラム色にしました。'
        },
        '「解压工具」：ZIP / JAR / WAR / TAR / TAR.GZ / 7Z / RAR / CAB 本地解压。': {
            en: 'New "Archives" tool: extract ZIP / JAR / WAR / TAR / TAR.GZ / 7Z / RAR / CAB locally.',
            ja: '「解凍ツール」を追加。ZIP / JAR / WAR / TAR / TAR.GZ / 7Z / RAR / CAB をローカルで解凍できます。'
        },
        '光盘与软件包：ISO / IMG / BIN、APK / IPA / DEB / RPM / XAR 内容浏览与提取。': {
            en: 'Discs and packages: browse and extract ISO / IMG / BIN and APK / IPA / DEB / RPM / XAR.',
            ja: 'ディスクとパッケージ：ISO / IMG / BIN、APK / IPA / DEB / RPM / XAR の内容を閲覧・抽出できます。'
        },
        '可按文件单独下载，或一键打包成 ZIP 下载；加密压缩包支持填写密码。': {
            en: 'Download files individually or pack everything into one ZIP; encrypted archives accept a password.',
            ja: 'ファイルごとのダウンロードや ZIP への一括パッケージにも対応。暗号化された圧縮ファイルはパスワードを入力できます。'
        },
        '解压引擎为本地 WebAssembly，文件不上传；磁盘镜像（VMDK / VHD / QCOW2 / DMG 等）浏览器无法解析。': {
            en: 'Extraction runs on a local WebAssembly engine and files are never uploaded; browsers cannot parse disk images (VMDK / VHD / QCOW2 / DMG, etc.).',
            ja: '解凍エンジンはローカルの WebAssembly で、ファイルはアップロードされません。ディスクイメージ（VMDK / VHD / QCOW2 / DMG など）はブラウザでは解析できません。'
        },
        '「文档转换」工具：图片转 PDF、PDF 转图片（PNG / JPG / WEBP）、文档转 PDF、PDF 提取文字。': {
            en: 'New "Documents" tool: images to PDF, PDF to images (PNG / JPG / WEBP), documents to PDF, and PDF text extraction.',
            ja: '「ドキュメント変換」ツールを追加。画像→PDF、PDF→画像（PNG / JPG / WEBP）、文書→PDF、PDF のテキスト抽出に対応。'
        },
        '图片格式互转：PNG / JPG / JPEG / WEBP，可调质量，支持批量。': {
            en: 'Image format conversion: PNG / JPG / JPEG / WEBP with adjustable quality and batch support.',
            ja: '画像形式の相互変換：PNG / JPG / JPEG / WEBP。品質調整と一括処理に対応。'
        },
        '全站反爬虫策略：robots.txt、常见采集与 AI 爬虫 UA 拦截、接口频率限制。': {
            en: 'Site-wide anti-scraping: robots.txt, UA blocking for common crawlers and AI bots, and API rate limits.',
            ja: 'サイト全体のクローラー対策：robots.txt、一般的な収集ボットと AI クローラーの UA ブロック、API のレート制限。'
        },
        '左侧工具栏加入「格式转换」：视频提取音频，支持 MP3 / WAV / FLAC / OGG / M4A / AAC / OPUS。': {
            en: 'Added "Convert" to the sidebar: extract audio from video in MP3 / WAV / FLAC / OGG / M4A / AAC / OPUS.',
            ja: '左側ツールバーに「フォーマット変換」を追加。動画から MP3 / WAV / FLAC / OGG / M4A / AAC / OPUS の音声を抽出できます。'
        },
        '视频互转 MP4 / MOV / WEBM / MKV / AVI，以及 GIF 动图导出。': {
            en: 'Convert between MP4 / MOV / WEBM / MKV / AVI, plus GIF export.',
            ja: 'MP4 / MOV / WEBM / MKV / AVI の相互変換と GIF 書き出しに対応。'
        },
        '转换全部在浏览器本地完成，文件不上传服务器；首次使用加载约 32MB 引擎。': {
            en: 'All conversion runs locally in the browser and files are never uploaded; the first use loads a ~32MB engine.',
            ja: '変換はすべてブラウザ内で行われ、ファイルはアップロードされません。初回は約 32MB のエンジンを読み込みます。'
        },
        '移除页面里的占位文案与表情符号，首页按钮补上真实说明。': {
            en: 'Removed placeholder copy and emoji, and gave the home buttons real descriptions.',
            ja: 'ページ内の仮テキストと絵文字を削除し、ホームのボタンに実際の説明を追加しました。'
        },
        '正文区域加宽并居中，大屏下不再贴着左边。': {
            en: 'Widened and centered the main area so it no longer sticks to the left on large screens.',
            ja: '本文エリアを広げて中央寄せにし、大画面でも左に寄らなくなりました。'
        },
        '聊天页高度按视口自适应，手机端输入框不再被顶出屏幕。': {
            en: 'The chat page now adapts to the viewport height, so the input stays on screen on mobile.',
            ja: 'チャットページの高さを画面に合わせ、スマホでも入力欄が画面外に出なくなりました。'
        },
        '补齐键盘焦点样式、按钮悬停反馈，移动端间距收紧。': {
            en: 'Improved keyboard focus styles and button hover feedback, and tightened spacing on mobile.',
            ja: 'キーボードフォーカスの表示とボタンのホバー反応を補い、モバイルの余白を詰めました。'
        },
        '独立超管后台': { en: 'Dedicated admin dashboard', ja: '専用の管理画面' },
        '：实时查看在线、用户、发帖与 AI 用量。': {
            en: ': live stats for online users, accounts, posts and AI usage.',
            ja: '：オンライン・アカウント・投稿・AI 利用状況をリアルタイムで確認。'
        },
        '超管可单独给某个账号下发额外 AI 额度。': {
            en: 'Admins can grant extra AI quota to individual accounts.',
            ja: '管理者は特定のアカウントに追加の AI 利用枠を付与できます。'
        },
        '超管可封禁 / 解封 / 删除账号，隐藏 / 删除帖子。': {
            en: 'Admins can ban / unban / delete accounts and hide / delete posts.',
            ja: '管理者はアカウントの禁止・解除・削除、投稿の非表示・削除ができます。'
        },
        '超管登录失败限流、操作日志，令牌 2 小时自动过期。': {
            en: 'Admin login rate limiting, operation logs, and tokens that expire after 2 hours.',
            ja: '管理者ログインの試行制限、操作ログ、2 時間で失効するトークン。'
        },
        '更新日志版本号统一从 v1.0.0 起顺序递增。': {
            en: 'Changelog version numbers now increment in order from v1.0.0.',
            ja: '更新履歴のバージョン番号を v1.0.0 から順番に統一しました。'
        },
        '未登录时右上角缺少头像圆圈。': {
            en: 'Fixed the missing avatar circle in the top right when logged out.',
            ja: '未ログイン時に右上のアバター丸が表示されない問題を修正。'
        },
        '验证码发送失败时提示更明确，并补充服务端日志。': {
            en: 'Clearer messages when sending a code fails, plus server-side logs.',
            ja: '認証コード送信失敗時のメッセージを明確にし、サーバーログを追加。'
        },
        '静态资源加版本号，避免浏览器/CDN 缓存旧脚本导致按钮失效。': {
            en: 'Added version numbers to static assets to prevent stale cached scripts from breaking buttons.',
            ja: '静的リソースにバージョンを付与し、ブラウザ/CDN の古いキャッシュでボタンが動かなくなるのを防止。'
        },
        'AI 聊天记录保存到服务器，换设备登录也能接着聊。': {
            en: 'AI chat history is saved on the server, so you can continue on another device.',
            ja: 'AI チャット履歴をサーバーに保存し、別の端末でも続きから話せます。'
        },
        '每位用户每天 50 条 AI 额度，用完次日 0 点恢复。': {
            en: 'Each user gets 50 AI messages per day, reset at midnight.',
            ja: '各ユーザーは 1 日 50 件の AI 利用枠。使い切ると翌日 0 時に回復します。'
        },
        '用户中心重做：生日、邮箱换绑、修改密码、用量统计。': {
            en: 'Reworked the profile: birthday, email change, password change and usage stats.',
            ja: 'ユーザーセンターを刷新：誕生日、メール変更、パスワード変更、利用統計。'
        },
        '验证码发送失败时给出具体提示，并限制发送频率。': {
            en: 'Specific messages when code sending fails, with send-rate limiting.',
            ja: '認証コード送信失敗時に具体的な案内を表示し、送信頻度を制限。'
        },
        '去掉更新日志里的「返回登录」，避免页面里再套一层网站。': {
            en: 'Removed "back to login" from the changelog to avoid nesting one site inside another.',
            ja: '更新履歴内の「ログインに戻る」を削除し、ページ内にサイトが入れ子になるのを防止。'
        },
        '论坛、AI、SVC、日志、用户中心都在左侧栏内切换。': {
            en: 'Forum, AI, SVC, changelog and profile all switch within the sidebar.',
            ja: '掲示板・AI・SVC・更新履歴・ユーザーセンターを左サイドバー内で切り替え。'
        },
        '老账号 UID 显示「未分配」。': {
            en: 'Fixed old accounts showing "unassigned" for UID.',
            ja: '古いアカウントの UID が「未割り当て」と表示される問題を修正。'
        },
        '用户可以注销自己的账号。': {
            en: 'Users can delete their own accounts.',
            ja: 'ユーザーが自分のアカウントを削除できるようになりました。'
        },
        '邮箱验证码注册与登录。': {
            en: 'Email verification code registration and login.',
            ja: 'メール認証コードによる登録とログイン。'
        },
        '独立的注册页面。': {
            en: 'A standalone registration page.',
            ja: '独立した登録ページ。'
        },
        '数据库缺少 email 字段导致的 500 错误。': {
            en: 'Fixed 500 errors caused by the missing email column in the database.',
            ja: 'データベースに email 列がなく 500 エラーになる問題を修正。'
        },
        '用户名密码注册与登录。': {
            en: 'Username and password registration and login.',
            ja: 'ユーザー名とパスワードによる登録とログイン。'
        },
        '发帖和帖子列表。': {
            en: 'Posting and post lists.',
            ja: '投稿と投稿一覧。'
        },
        '更新日志正文支持多语言：日期与历次版本说明会跟随中文 / 日语 / 英语一起切换。': {
            en: 'Changelog content now supports multiple languages: dates and past entries follow Chinese / Japanese / English.',
            ja: '更新履歴の本文が多言語対応に。日付と過去の各バージョン説明も中国語 / 日本語 / 英語に追随します。'
        },
        '公告类内容按当前界面语言显示，切换语言后无需刷新页面。': {
            en: 'Announcement content follows the current interface language and updates without refreshing.',
            ja: 'お知らせ内容は現在の表示言語に合わせて切り替わり、再読み込みは不要です。'
        }
    };
    Object.assign(WORDS, LOG_WORDS);

    /* ---------------- 效率工具：待办 / 图床 / 短链接 / Markdown 笔记 ---------------- */
    const TOOL_WORDS = {
        '效率': { en: 'Productivity', ja: '効率化' },
        '待办清单': { en: 'To-do list', ja: 'やることリスト' },
        '图床': { en: 'Image host', ja: '画像ホスト' },
        '短链接': { en: 'Short links', ja: '短縮リンク' },
        'Markdown 笔记': { en: 'Markdown notes', ja: 'Markdown ノート' },

        /* 待办 */
        '登录后同步到云端，换设备也能接着用': {
            en: 'Synced to the cloud after login, so you can continue on any device',
            ja: 'ログインするとクラウドに同期され、別の端末でも続けられます'
        },
        '添加一条待办，回车即可保存': { en: 'Add a to-do and press Enter to save', ja: 'やることを入力して Enter で保存' },
        '添加': { en: 'Add', ja: '追加' },
        '清除已完成': { en: 'Clear completed', ja: '完了済みを消去' },
        '未登录时待办只保存在这台设备；登录后会保存到云端。': {
            en: 'When logged out, to-dos are saved only on this device; log in to sync them to the cloud.',
            ja: '未ログインの場合、やることはこの端末にのみ保存されます。ログインするとクラウドに保存されます。'
        },
        '还没有待办，先加一条吧。': { en: 'No to-dos yet. Add your first one.', ja: 'まだやることがありません。最初の 1 件を追加しましょう。' },
        '还没有已完成的待办。': { en: 'No completed to-dos yet.', ja: '完了したやることはまだありません。' },
        '先写点要做什么。': { en: 'Write something to do first.', ja: 'まずやることを入力してください。' },
        '已保存在本机，登录后会改为云端同步。': {
            en: 'Saved on this device. Log in to switch to cloud sync.',
            ja: 'この端末に保存しました。ログインするとクラウド同期に切り替わります。'
        },
        '已添加。': { en: 'Added.', ja: '追加しました。' },
        '正在同步云端待办…': { en: 'Syncing to-dos from the cloud...', ja: 'クラウドのやることリストを同期中...' },
        '状态同步失败，刷新后可能不一致。': { en: 'Failed to sync status; it may differ after refreshing.', ja: '状態の同期に失敗しました。更新後に差異が出る場合があります。' },
        '删除同步失败，请刷新重试。': { en: 'Failed to sync deletion. Refresh and try again.', ja: '削除の同期に失敗しました。更新して再試行してください。' },
        '还没有待办。': { en: 'No to-dos yet.', ja: 'やることはありません。' },

        /* 图床 */
        '上传后得到直链，可用于论坛配图或分享截图': {
            en: 'Get a direct link for forum images or sharing screenshots',
            ja: 'アップロードすると直リンクを取得でき、掲示板の画像やスクリーンショット共有に使えます'
        },
        '点击选择图片，或把截图拖到这里': { en: 'Click to choose images, or drop screenshots here', ja: 'クリックして画像を選択、またはスクリーンショットをここにドロップ' },
        '支持 PNG / JPG / WEBP / GIF，单张不超过 8MB，也可以直接 Ctrl + V 粘贴': {
            en: 'PNG / JPG / WEBP / GIF, up to 8MB each. You can also paste with Ctrl + V',
            ja: 'PNG / JPG / WEBP / GIF 対応、1 枚 8MB まで。Ctrl + V で貼り付けもできます'
        },
        '登录后即可上传，图片会保存到服务器。': { en: 'Log in to upload; images are stored on the server.', ja: 'ログインするとアップロードできます。画像はサーバーに保存されます。' },
        '上传的图片保存在服务器 uploads 目录，删除记录时会一并删除文件。': {
            en: 'Uploaded images are stored in the server uploads folder and removed together with the record.',
            ja: 'アップロードした画像はサーバーの uploads フォルダに保存され、記録の削除と同時にファイルも削除されます。'
        },
        '登录后可以查看自己上传过的图片。': { en: 'Log in to see images you have uploaded.', ja: 'ログインするとアップロード済みの画像を確認できます。' },
        '还没有上传过图片。': { en: 'No images uploaded yet.', ja: 'まだ画像をアップロードしていません。' },
        '刚刚上传': { en: 'Just uploaded', ja: 'アップロード直後' },
        '复制链接': { en: 'Copy link', ja: 'リンクをコピー' },
        '删除': { en: 'Delete', ja: '削除' },
        '登录后才能上传图片。': { en: 'Log in to upload images.', ja: '画像をアップロードするにはログインが必要です。' },
        '请选择 PNG / JPG / WEBP / GIF 图片。': { en: 'Please choose PNG / JPG / WEBP / GIF images.', ja: 'PNG / JPG / WEBP / GIF 画像を選択してください。' },
        '准备上传': { en: 'Preparing to upload', ja: 'アップロード準備中' },
        '登录已过期，请重新登录。': { en: 'Your session expired. Please log in again.', ja: 'ログインの有効期限が切れました。再度ログインしてください。' },

        /* 短链接 */
        '长链接一键变短，分享更方便': { en: 'Turn long links into short ones for easier sharing', ja: '長いリンクをワンクリックで短縮して共有を簡単に' },
        '粘贴长链接，例如 https://example.com/very/long/path': {
            en: 'Paste a long link, e.g. https://example.com/very/long/path',
            ja: '長いリンクを貼り付け（例：https://example.com/very/long/path）'
        },
        '生成短链': { en: 'Shorten', ja: '短縮する' },
        '登录后可以生成并管理自己的短链接。': { en: 'Log in to create and manage your short links.', ja: 'ログインすると短縮リンクの作成と管理ができます。' },
        '短链接已生成': { en: 'Short link created', ja: '短縮リンクを作成しました' },
        '复制': { en: 'Copy', ja: 'コピー' },
        '还没有生成过短链接。': { en: 'No short links yet.', ja: 'まだ短縮リンクがありません。' },
        '登录后才能生成短链接。': { en: 'Log in to create short links.', ja: '短縮リンクの作成にはログインが必要です。' },
        '先粘贴一个长链接。': { en: 'Paste a long link first.', ja: 'まず長いリンクを貼り付けてください。' },
        '正在生成…': { en: 'Creating...', ja: '作成中...' },
        '生成成功，点右侧按钮复制。': { en: 'Created. Click the button on the right to copy.', ja: '作成しました。右のボタンでコピーできます。' },
        '已删除。': { en: 'Deleted.', ja: '削除しました。' },

        /* Markdown 笔记 */
        '左边写 Markdown，右边实时预览，内容保存在服务器': {
            en: 'Write Markdown on the left, preview live on the right; notes are saved on the server',
            ja: '左で Markdown を書き、右でリアルタイムプレビュー。内容はサーバーに保存されます'
        },
        '新建笔记': { en: 'New note', ja: '新規ノート' },
        '笔记标题': { en: 'Note title', ja: 'ノートのタイトル' },
        'AI 润色': { en: 'AI polish', ja: 'AI 推敲' },
        '只看预览': { en: 'Preview only', ja: 'プレビューのみ' },
        '返回编辑': { en: 'Back to edit', ja: '編集に戻る' },
        '保存': { en: 'Save', ja: '保存' },
        '在这里写 Markdown，右侧会实时预览': { en: 'Write Markdown here; the right side previews live', ja: 'ここに Markdown を書くと、右側にリアルタイムでプレビューされます' },
        '未登录时无法保存笔记，请先登录。': { en: 'Log in first to save notes.', ja: 'ノートを保存するにはログインしてください。' },
        '开始写 Markdown，这里会实时预览。': { en: 'Start writing Markdown; the preview appears here.', ja: 'Markdown を書き始めると、ここにプレビューが表示されます。' },
        '还没有笔记。': { en: 'No notes yet.', ja: 'まだノートがありません。' },
        '还没有笔记，点「新建笔记」开始吧。': { en: 'No notes yet. Click "New note" to start.', ja: 'まだノートがありません。「新規ノート」から始めましょう。' },
        '未命名笔记': { en: 'Untitled note', ja: '無題のノート' },
        '登录后才能保存笔记。': { en: 'Log in to save notes.', ja: 'ノートの保存にはログインが必要です。' },
        '登录后才能使用 AI 润色。': { en: 'Log in to use AI polish.', ja: 'AI 推敲を使うにはログインが必要です。' },
        '登录后才能删除笔记。': { en: 'Log in to delete notes.', ja: 'ノートの削除にはログインが必要です。' },
        '新笔记，写完点保存。': { en: 'New note. Click Save when done.', ja: '新しいノートです。書き終えたら保存を押してください。' },
        '正在保存…': { en: 'Saving...', ja: '保存中...' },
        '已保存。': { en: 'Saved.', ja: '保存しました。' },
        'AI 正在润色，稍等一下…': { en: 'AI is polishing, one moment...', ja: 'AI が推敲中です。少々お待ちください...' },
        '润色完成，确认没问题后点保存。': { en: 'Polishing done. Click Save after reviewing.', ja: '推敲が完了しました。確認後に保存してください。' },
        '先写点内容再润色。': { en: 'Write something before polishing.', ja: '推敲する前に内容を書いてください。' },
        '当前没有已保存的笔记。': { en: 'There is no saved note yet.', ja: '保存済みのノートがありません。' },
        '当前笔记还没保存，确定切换到另一篇吗？': { en: 'The current note is unsaved. Switch anyway?', ja: '現在のノートは未保存です。切り替えますか？' },

        /* v1.1.5 更新日志 */
        '云端待办清单：添加、勾选完成、一键清除，登录后换设备也能继续。': {
            en: 'Cloud to-do list: add, check off and clear completed items; continue on any device after logging in.',
            ja: 'クラウドのやることリスト：追加・完了チェック・一括削除ができ、ログインすれば別端末でも続けられます。'
        },
        '极简图床：上传图片得到直链，支持拖拽与 Ctrl + V 粘贴，可复制地址或删除。': {
            en: 'Minimal image host: upload images to get direct links, with drag & drop and Ctrl + V paste, copy and delete.',
            ja: 'シンプルな画像ホスト：画像をアップロードして直リンクを取得。ドラッグ＆ドロップや Ctrl + V 貼り付け、コピー・削除に対応。'
        },
        '短链接生成器：长链接一键变短，带访问次数统计与管理。': {
            en: 'Short link generator: shorten long links in one click, with visit counts and management.',
            ja: '短縮リンク生成：長いリンクをワンクリックで短縮。アクセス回数の統計と管理付き。'
        },
        'Markdown 笔记：左侧书写右侧实时预览，支持一键 AI 润色，内容保存在服务器。': {
            en: 'Markdown notes: write on the left, live preview on the right, one-click AI polish, saved on the server.',
            ja: 'Markdown ノート：左で書き右でリアルタイムプレビュー。ワンクリック AI 推敲に対応し、内容はサーバーに保存されます。'
        },
        '以上功能位于左侧「效率」分组；未登录时待办只保存在本机，图床与笔记需要登录。': {
            en: 'These features live in the "Productivity" group; while logged out, to-dos stay on this device, and image host and notes require login.',
            ja: 'これらの機能は左側の「効率化」グループにあります。未ログイン時はやることがこの端末にのみ保存され、画像ホストとノートにはログインが必要です。'
        }
    };
    Object.assign(WORDS, TOOL_WORDS);

    /* ---------------- 高速下载 ---------------- */
    const DOWNLOAD_WORDS = {
        '高速下载': { en: 'Fast download', ja: '高速ダウンロード' },
        'GitHub / Hugging Face 链接自动换成镜像，下载由浏览器直连，不经过本站': {
            en: 'GitHub / Hugging Face links are converted to mirrors; downloads go straight from your browser, not through this site',
            ja: 'GitHub / Hugging Face のリンクを自動でミラーに変換。ダウンロードはブラウザから直接行われ、当サイトを経由しません'
        },
        '粘贴 GitHub、Hugging Face 或其他下载链接': { en: 'Paste a GitHub, Hugging Face or other download link', ja: 'GitHub・Hugging Face・その他のダウンロードリンクを貼り付け' },
        '解析': { en: 'Analyze', ja: '解析' },
        '支持 GitHub 文件 / Release / 仓库压缩包、Hugging Face 模型与数据集。': {
            en: 'Supports GitHub files, releases and repo archives, plus Hugging Face models and datasets.',
            ja: 'GitHub のファイル / Release / リポジトリのアーカイブ、Hugging Face のモデルとデータセットに対応。'
        },
        '原始链接': { en: 'Original link', ja: '元のリンク' },
        '镜像加速': { en: 'Mirrors', ja: 'ミラー加速' },
        '直链': { en: 'Direct', ja: '直リンク' },
        '自建中转': { en: 'Custom proxy', ja: '自前プロキシ' },
        '任选一个能打开的即可': { en: 'Pick whichever opens', ja: '開けるものを 1 つ選んでください' },
        'GitHub 链接': { en: 'GitHub link', ja: 'GitHub リンク' },
        'GitHub 文件': { en: 'GitHub file', ja: 'GitHub ファイル' },
        'GitHub Release': { en: 'GitHub release', ja: 'GitHub リリース' },
        'GitHub 仓库压缩包': { en: 'GitHub repo archive', ja: 'GitHub リポジトリの ZIP' },
        '普通链接': { en: 'Regular link', ja: '通常のリンク' },
        '官方地址': { en: 'Official address', ja: '公式アドレス' },
        'hf-mirror.com 国内镜像': { en: 'hf-mirror.com mirror', ja: 'hf-mirror.com ミラー' },
        '公共镜像只覆盖 GitHub 与 Hugging Face': { en: 'Public mirrors only cover GitHub and Hugging Face', ja: '公共ミラーは GitHub と Hugging Face のみ対応' },
        '可以复制直链用下载工具加速': { en: 'Copy the direct link and use a download tool', ja: '直リンクをコピーしてダウンロードツールで加速できます' },
        '使用你填写的加速前缀': { en: 'Uses your custom acceleration prefix', ja: '入力した加速プレフィックスを使用' },
        '打开': { en: 'Open', ja: '開く' },
        '自建加速前缀（可选）': { en: 'Custom acceleration prefix (optional)', ja: '自前の加速プレフィックス（任意）' },
        '保存前缀': { en: 'Save prefix', ja: 'プレフィックスを保存' },
        '已生成下载地址，点「打开」由浏览器直连镜像下载。': {
            en: 'Links generated. Click "Open" to download directly from the mirror.',
            ja: 'リンクを生成しました。「開く」でミラーから直接ダウンロードできます。'
        },
        '这个链接看起来不太对，检查一下再试。': { en: 'That link does not look right. Please check it and try again.', ja: 'リンクが正しくないようです。確認してもう一度お試しください。' },
        '已保存自建加速前缀，重新解析即可生效。': { en: 'Custom prefix saved. Analyze again to apply it.', ja: 'プレフィックスを保存しました。再解析すると反映されます。' },
        '已清除自建加速前缀。': { en: 'Custom prefix cleared.', ja: 'プレフィックスを削除しました。' },
        '使用说明': { en: 'How to use', ja: '使い方' },
        '公共镜像只覆盖 GitHub 与 Hugging Face，打不开就换另一个镜像；镜像服务由第三方提供，可能随时失效。': {
            en: 'Public mirrors cover only GitHub and Hugging Face. If one fails, try another; third-party mirrors may stop working at any time.',
            ja: '公共ミラーは GitHub と Hugging Face のみ対応です。開けない場合は別のミラーを試してください。サードパーティ製のため予告なく停止する場合があります。'
        },
        '下载由浏览器直接连接镜像，不经过本站服务器，因此不受服务器带宽影响，也不占用服务器流量。': {
            en: 'Downloads connect from your browser straight to the mirror, bypassing this server, so slow server bandwidth does not matter and no server traffic is used.',
            ja: 'ダウンロードはブラウザからミラーに直接接続するため、当サーバーを経由しません。サーバーの帯域に影響されず、通信量も消費しません。'
        },
        '粘贴仓库地址默认按 main 分支打包；如果仓库使用 master 分支，把生成链接里的 main 改成 master 即可。': {
            en: 'Repository links are packed from the main branch by default; if the repo uses master, change main to master in the generated link.',
            ja: 'リポジトリのリンクは既定で main ブランチを ZIP 化します。master ブランチの場合は生成リンクの main を master に変えてください。'
        },
        '其他网站没有公共镜像，可以复制直链到下载工具，或填写你自建的中转前缀（支持 {url} 占位符）。': {
            en: 'Other sites have no public mirror: copy the direct link into a download tool, or fill in your own proxy prefix (supports the {url} placeholder).',
            ja: '他のサイトには公共ミラーがありません。直リンクをダウンロードツールに渡すか、自前の中継プレフィックスを入力してください（{url} プレースホルダー対応）。'
        },
        '「高速下载」：粘贴 GitHub 文件 / Release / 仓库地址，自动生成多个镜像下载链接。': {
            en: '"Fast download": paste a GitHub file, release or repo URL to generate several mirror links automatically.',
            ja: '「高速ダウンロード」：GitHub のファイル / Release / リポジトリの URL を貼り付けると、複数のミラーリンクを自動生成します。'
        },
        'Hugging Face 模型与数据集一键换成 hf-mirror.com 地址，也支持 raw.githubusercontent.com。': {
            en: 'Hugging Face models and datasets switch to hf-mirror.com in one click; raw.githubusercontent.com is supported too.',
            ja: 'Hugging Face のモデルとデータセットをワンクリックで hf-mirror.com に変換。raw.githubusercontent.com にも対応。'
        },
        '任意链接可生成直链；填写自建加速前缀后可生成中转链接，前缀保存在本地。': {
            en: 'Any URL can be turned into a direct link; with a custom prefix you also get proxy links, saved locally.',
            ja: '任意の URL を直リンク化できます。自前プレフィックスを入力すると中継リンクも生成され、ローカルに保存されます。'
        },
        '下载由浏览器直连镜像，不经过本站服务器，不占用服务器带宽；公共镜像失效时换一个即可。': {
            en: 'Downloads go from the browser to the mirror directly, bypassing this server and its bandwidth; if a public mirror fails, try another.',
            ja: 'ダウンロードはブラウザからミラーへ直接行われ、当サーバーや帯域を使いません。公共ミラーが使えない場合は別のものをお試しください。'
        }
    };
    Object.assign(WORDS, DOWNLOAD_WORDS);

    /* 带变量的句子：用正则匹配后再翻译 */
    const PATTERNS = [
        {
            re: /^今日剩余 (\d+) 条$/,
            en: (m) => m[1] + ' left today',
            ja: (m) => '本日あと ' + m[1] + ' 件'
        },
        {
            re: /^(\d+)秒$/,
            en: (m) => m[1] + 's',
            ja: (m) => m[1] + '秒'
        },
        {
            re: /^已载入视频：(\d+)×(\d+)，拖动进度条选好画面后点「截取当前帧」。$/,
            en: (m) => 'Video loaded: ' + m[1] + '×' + m[2] + '. Drag the slider and click "Capture current frame".',
            ja: (m) => '動画を読み込みました：' + m[1] + '×' + m[2] + '。スライダーで画面を選び「現在のフレームを保存」を押してください。'
        },
        {
            re: /^正在处理 (\d+) \/ (\d+)…$/,
            en: (m) => 'Processing ' + m[1] + ' / ' + m[2] + '...',
            ja: (m) => m[1] + ' / ' + m[2] + ' を処理中...'
        },
        {
            re: /^正在合成第 (\d+) \/ (\d+) 页…$/,
            en: (m) => 'Building page ' + m[1] + ' / ' + m[2] + '...',
            ja: (m) => m[1] + ' / ' + m[2] + ' ページ目を合成中...'
        },
        {
            re: /^正在导出第 (\d+) \/ (\d+) 页…$/,
            en: (m) => 'Exporting page ' + m[1] + ' / ' + m[2] + '...',
            ja: (m) => m[1] + ' / ' + m[2] + ' ページ目を書き出し中...'
        },
        {
            re: /^正在生成第 (\d+) \/ (\d+) 页…$/,
            en: (m) => 'Rendering page ' + m[1] + ' / ' + m[2] + '...',
            ja: (m) => m[1] + ' / ' + m[2] + ' ページ目を生成中...'
        },
        {
            re: /^正在提取第 (\d+) \/ (\d+) 页…$/,
            en: (m) => 'Extracting page ' + m[1] + ' / ' + m[2] + '...',
            ja: (m) => m[1] + ' / ' + m[2] + ' ページ目を抽出中...'
        },
        {
            re: /^导出完成，共 (\d+) 张图片。$/,
            en: (m) => 'Export complete. ' + m[1] + ' image(s).',
            ja: (m) => '書き出し完了。画像 ' + m[1] + ' 枚。'
        },
        {
            re: /^已选择「(.+)」，点上方虚线区域选择文件。$/,
            en: (m) => 'Selected "' + tr(m[1]) + '". Click the dashed area above to choose a file.',
            ja: (m) => '「' + tr(m[1]) + '」を選択しました。上の点線エリアからファイルを選択してください。'
        },
        {
            re: /^读取完成：共 (\d+) 个文件，可单独下载或全部打包下载。$/,
            en: (m) => 'Done: ' + m[1] + ' file(s). Download individually or as a ZIP.',
            ja: (m) => '読み込み完了：' + m[1] + ' ファイル。個別または ZIP でまとめてダウンロードできます。'
        },
        {
            re: /^正在读取 (\d+) \/ (\d+) 个文件…$/,
            en: (m) => 'Reading file ' + m[1] + ' / ' + m[2] + '...',
            ja: (m) => m[1] + ' / ' + m[2] + ' ファイルを読み込み中...'
        },
        {
            re: /^正在打包 (\d+)%…$/,
            en: (m) => 'Packaging ' + m[1] + '%...',
            ja: (m) => 'パッケージ化 ' + m[1] + '%...'
        },
        {
            re: /^(\d+) 个文件 · (.+)$/,
            en: (m) => m[1] + ' file(s) · ' + m[2],
            ja: (m) => m[1] + ' ファイル · ' + m[2]
        },
        {
            re: /^选择 (.+) 文件$/,
            en: (m) => 'Choose ' + m[1] + ' file',
            ja: (m) => m[1] + ' ファイルを選択'
        },
        {
            re: /^(\d+) 项待办$/,
            en: (m) => m[1] + ' to-do(s)',
            ja: (m) => m[1] + ' 件'
        },
        {
            re: /^已同步到云端，共 (\d+) 条。$/,
            en: (m) => 'Synced to the cloud: ' + m[1] + ' item(s).',
            ja: (m) => 'クラウドに同期しました：' + m[1] + ' 件。'
        },
        {
            re: /^正在上传 (\d+) \/ (\d+)…$/,
            en: (m) => 'Uploading ' + m[1] + ' / ' + m[2] + '...',
            ja: (m) => m[1] + ' / ' + m[2] + ' をアップロード中...'
        },
        {
            re: /^准备上传 (\d+) 张图片…$/,
            en: (m) => 'Preparing to upload ' + m[1] + ' image(s)...',
            ja: (m) => '画像 ' + m[1] + ' 枚のアップロードを準備中...'
        },
        {
            re: /^上传完成，共 (\d+) 张，直链可以直接复制。$/,
            en: (m) => 'Upload complete: ' + m[1] + ' image(s). Copy the direct link.',
            ja: (m) => 'アップロード完了：' + m[1] + ' 枚。直リンクをコピーできます。'
        },
        {
            re: /^今天已上传 (\d+) \/ (\d+) 张。$/,
            en: (m) => 'Uploaded today: ' + m[1] + ' / ' + m[2] + '.',
            ja: (m) => '本日のアップロード：' + m[1] + ' / ' + m[2] + ' 枚。'
        },
        {
            re: /^成功 (\d+) 张，失败 (\d+) 张：(.*)$/,
            en: (m) => m[1] + ' succeeded, ' + m[2] + ' failed: ' + m[3],
            ja: (m) => '成功 ' + m[1] + ' 枚、失敗 ' + m[2] + ' 枚：' + m[3]
        },
        {
            re: /^(\d+) 次访问$/,
            en: (m) => m[1] + ' visit(s)',
            ja: (m) => m[1] + ' 回アクセス'
        },
        {
            re: /^共 (\d+) 篇笔记。$/,
            en: (m) => m[1] + ' note(s).',
            ja: (m) => 'ノート ' + m[1] + ' 件。'
        },
        {
            re: /^已打开「(.+)」。$/,
            en: (m) => 'Opened "' + tr(m[1]) + '".',
            ja: (m) => '「' + tr(m[1]) + '」を開きました。'
        },
        {
            re: /^链接已复制：(\S+)$/,
            en: (m) => 'Link copied: ' + m[1],
            ja: (m) => 'リンクをコピーしました：' + m[1]
        },
        {
            re: /^短链接已复制：(\S+)$/,
            en: (m) => 'Short link copied: ' + m[1],
            ja: (m) => '短縮リンクをコピーしました：' + m[1]
        },
        {
            re: /^下载地址已复制：(\S+)$/,
            en: (m) => 'Download link copied: ' + m[1],
            ja: (m) => 'ダウンロードリンクをコピーしました：' + m[1]
        }
    ];

    /* ---------------- 原文记录，用于切回中文 ---------------- */
    const ORIG_TEXT = new WeakMap();
    const ORIG_ATTR = new WeakMap();
    const ATTRS = ['placeholder', 'title', 'aria-label'];
    const SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, IFRAME: 1, CODE: 1, PRE: 1, NOSCRIPT: 1 };

    function shouldSkip(el) {
        if (!el || el.nodeType !== 1) return false;
        if (SKIP_TAGS[el.tagName]) return true;
        if (el.id === 'lang-select' || el.closest('#lang-select')) return true;
        if (el.hasAttribute('data-no-i18n')) return true;
        return false;
    }

    function translateValue(text) {
        if (!text) return null;
        const hit = WORDS[text];
        if (hit) return hit[lang] != null ? hit[lang] : null;
        for (let i = 0; i < PATTERNS.length; i++) {
            const p = PATTERNS[i];
            const m = text.match(p.re);
            if (m) return p[lang](m);
        }
        return null;
    }

    /* 页面内部使用：把中文短语翻成当前语言 */
    function tr(text) {
        if (lang === 'zh') return text;
        const out = translateValue(String(text));
        return out == null ? text : out;
    }

    function localizeTextNode(node) {
        const parent = node.parentNode;
        if (!parent || shouldSkip(parent)) return;
        const cur = node.nodeValue;
        const key = cur.trim();
        if (!key) return;
        if (lang === 'zh') return;
        const out = translateValue(key);
        if (out != null) {
            if (!ORIG_TEXT.has(node)) ORIG_TEXT.set(node, cur);
            const start = cur.indexOf(key);
            const next = cur.slice(0, start) + out + cur.slice(start + key.length);
            if (next !== cur) node.nodeValue = next;
        } else if (CJK.test(key) && !ORIG_TEXT.has(node)) {
            ORIG_TEXT.set(node, cur);
        }
    }

    function localizeText(root) {
        if (!root) return;
        if (root.nodeType === 3) { localizeTextNode(root); return; }
        if (root.nodeType !== 1 || shouldSkip(root)) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        let node = walker.nextNode();
        while (node) {
            localizeTextNode(node);
            node = walker.nextNode();
        }
    }

    function localizeAttrs(root) {
        if (!root || root.nodeType !== 1 || shouldSkip(root)) return;
        const list = [root].concat(Array.prototype.slice.call(root.querySelectorAll('[placeholder],[title],[aria-label]')));
        list.forEach((el) => {
            if (shouldSkip(el)) return;
            let saved = ORIG_ATTR.get(el);
            ATTRS.forEach((attr) => {
                const cur = el.getAttribute(attr);
                if (!cur) return;
                if (lang === 'zh') {
                    if (saved && saved[attr] != null) el.setAttribute(attr, saved[attr]);
                    return;
                }
                const out = translateValue(cur.trim());
                if (out == null) {
                    if (CJK.test(cur)) {
                        saved = saved || {};
                        if (saved[attr] == null) saved[attr] = cur;
                        ORIG_ATTR.set(el, saved);
                    }
                    return;
                }
                saved = saved || {};
                if (saved[attr] == null) saved[attr] = cur;
                ORIG_ATTR.set(el, saved);
                if (out !== cur) el.setAttribute(attr, out);
            });
        });
    }

    function restoreAll() {
        const root = document.body;
        if (!root) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        let node = walker.nextNode();
        while (node) {
            if (ORIG_TEXT.has(node)) node.nodeValue = ORIG_TEXT.get(node);
            node = walker.nextNode();
        }
        const els = root.querySelectorAll('[placeholder],[title],[aria-label]');
        Array.prototype.forEach.call(els, (el) => {
            const saved = ORIG_ATTR.get(el);
            if (!saved) return;
            ATTRS.forEach((attr) => {
                if (saved[attr] != null) el.setAttribute(attr, saved[attr]);
            });
        });
    }

    let pageZh = '';

    function setPageTitle(zh) {
        pageZh = zh || pageZh;
        const el = document.getElementById('page-title');
        if (!el) return;
        el.textContent = tr(pageZh);
    }

    function zhTextOf(el) {
        if (!el) return '';
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
        let node = walker.nextNode();
        while (node) {
            if (node.nodeValue && node.nodeValue.trim()) {
                return ORIG_TEXT.get(node) || node.nodeValue.trim();
            }
            node = walker.nextNode();
        }
        return el.textContent.trim();
    }

    /* ---------------- 应用语言 ---------------- */
    function applyLang(next) {
        if (LANGS.indexOf(next) < 0) next = 'zh';
        lang = next;
        try { localStorage.setItem(KEY_LANG, next); } catch (e) { /* 忽略隐私模式限制 */ }
        document.documentElement.lang = next === 'zh' ? 'zh-CN' : next;
        const sel = document.getElementById('lang-select');
        if (sel && sel.value !== next) sel.value = next;

        applying = true;
        if (observer) observer.disconnect();
        restoreAll();
        if (next !== 'zh' && document.body) {
            localizeText(document.body);
            localizeAttrs(document.body);
        }
        if (pageZh) setPageTitle(pageZh);
        applying = false;
        observe();

        document.title = tr('日向论坛');
        if (typeof window.refreshDynamicLang === 'function') window.refreshDynamicLang();
    }

    function currentLang() {
        return lang;
    }

    /* ---------------- 监听新插入的内容 ---------------- */
    function observe() {
        if (!observer || !document.body) return;
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ATTRS
        });
    }

    function onMutations() {
        if (lang === 'zh' || applying) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
            applying = true;
            if (observer) observer.disconnect();
            localizeText(document.body);
            localizeAttrs(document.body);
            applying = false;
            observe();
        }, 100);
    }

    /* ---------------- 主题 ---------------- */
    function setTheme(mode) {
        const next = mode === 'dark' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem(KEY_THEME, next); } catch (e) { /* 忽略 */ }
    }

    function toggleTheme() {
        const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        setTheme(cur === 'dark' ? 'light' : 'dark');
    }

    /* ---------------- 初始化 ---------------- */
    function init() {
        let savedLang = 'zh';
        try { savedLang = localStorage.getItem(KEY_LANG) || 'zh'; } catch (e) { /* 忽略 */ }
        if (LANGS.indexOf(savedLang) < 0) savedLang = 'zh';

        if (window.MutationObserver) {
            observer = new MutationObserver(onMutations);
        }

        const active = document.querySelector('.nav-item.active .nav-text') || document.querySelector('.nav-item .nav-text');
        pageZh = zhTextOf(active) || '首页大厅';

        applyLang(savedLang);
        if (!document.documentElement.getAttribute('data-theme')) setTheme('light');
    }

    window.applyLang = applyLang;
    window.toggleTheme = toggleTheme;
    window.setTheme = setTheme;
    window.getLang = currentLang;
    window.tr = tr;
    window.t = tr;
    window.setPageTitle = setPageTitle;
    window.zhTextOf = zhTextOf;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();


const HOME_HTML = `
<div class="menu">
  <a href="/ket-qua-xo-so/mien-nam/thu-hai.html">Thứ Hai</a>
  <a href="/ket-qua-xo-so/mien-nam/chu-nhat.html">Chủ Nhật</a>
  <a href="/ket-qua-xo-so/mien-nam/06-08-2026.html">06/08/2026</a>
  <a href="/ket-qua-xo-so/mien-nam/an-giang.html">Kết quả xổ số An Giang</a>
  <a href="/ket-qua-xo-so/mien-nam/tp-hcm.html">Kết quả xổ số TP. HCM</a>
  <a href="/ket-qua-xo-so/mien-nam/da-lat.html">Kết quả xổ số Đà Lạt</a>
  <a href="/ket-qua-xo-so/mien-nam/ben-tre.html">Kết quả xổ số Bến Tre</a>
  <a href="/ket-qua-xo-so/mien-nam/an-giang.html">Kết quả xổ số An Giang</a>
  <a href="/ket-qua-xo-so/mien-trung/da-nang.html">Kết quả xổ số Đà Nẵng</a>
  <a href="/ket-qua-xo-so/mien-trung/thua-thien-hue.html">Kết quả xổ số Huế</a>
  <a href="/ket-qua-xo-so/mien-bac/ha-noi.html">Kết quả xổ số H&agrave; Nội</a>
  <a href="/ket-qua-xo-so/mien-bac/bac-ninh.html">KQXS Bắc Ninh</a>
  <a href="/thong-ke-xo-so/tan-suat.html">Thống kê</a>
</div>
`;

const WEEKDAY_MULTI_PROVINCE_HTML = `
<div class="box_kqxs">
  <div class="top"><div class="title">
    <a href="/ket-qua-xo-so/mien-nam.html">KẾT QUẢ XỔ SỐ Miền Nam</a> -
    <a href="/ket-qua-xo-so/mien-nam/05-08-2026.html">05/08/2026</a></div></div>
  <div class="content"><table class="bkqmiennam"><tbody><tr>
    <td><table class="rightcl"><tbody>
      <tr><td class="tinh"><a href="/xo-so-mien-nam/dong-nai.html" title="Xổ Số Đồng Nai">Đồng Nai</a></td></tr>
      <tr><td class="giaidb"><div>804092</div></td></tr>
    </tbody></table></td>
    <td><table class="rightcl"><tbody>
      <tr><td class="tinh"><a href="/xo-so-mien-nam/can-tho.html" title="Xổ Số Cần Thơ">Cần Thơ</a></td></tr>
    </tbody></table></td>
    <td><table class="rightcl"><tbody>
      <tr><td class="tinh"><a href="/xo-so-mien-nam/soc-trang.html" title="Xổ Số Sóc Trăng">Sóc Trăng</a></td></tr>
    </tbody></table></td>
  </tr></tbody></table></div>
</div>
<div class="box_kqxs">
  <div class="content"><table><tbody><tr>
    <td class="tinh"><a href="/xo-so-mien-nam/vinh-long.html">Vĩnh Long</a></td>
  </tr></tbody></table></div>
</div>
`;

const WEEKDAY_SINGLE_PROVINCE_HTML = `
<div class="box_kqxs">
  <div class="top"><div class="bkm"><div class="title">
    <a href="/ket-qua-xo-so/mien-bac/bac-ninh.html">KẾT QUẢ XỔ SỐ Bắc Ninh</a> -
    <a href="/ket-qua-xo-so/mien-bac/bac-ninh/05-08-2026.html">05/08/2026</a></div></div></div>
  <div class="content"><table class="bkqtinhmienbac"><tbody>
    <!--<tr><td class="ngay">Ng&agrave;y: <a href="/kqxs/05-08-2026.html">05/08/2026</a></td></tr>-->
    <tr><td colspan=2><div class="ngay">Ng&agrave;y:
      <a href="/kqxs/05-08-2026.html">05/08/2026</a></div></td></tr>
    <tr><td class="giaidb"><div>12345</div></td></tr>
  </tbody></table></div>
</div>
`;

const EMPTY_HTML = '<html><body><h1>404 Not Found</h1></body></html>';

module.exports = {
  HOME_HTML,
  WEEKDAY_MULTI_PROVINCE_HTML,
  WEEKDAY_SINGLE_PROVINCE_HTML,
  EMPTY_HTML
};

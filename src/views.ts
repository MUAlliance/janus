import { renderFile } from 'ejs';
import * as cheerio from 'cheerio';

const VIEWS_PATH = process.env.VIEWS_PATH || 'views';
let BS_SITE_INFO: any = null;

async function fetchBlessingSkinSiteInfo() {
  const url = process.env.BS_SITE_URL || '';
  const html = await fetch(url).then(res => res.text());
  const $ = cheerio.load(html);
  const head = $('head');
  const name = $('title').text();
  head.children().each((i, el) => {
    if (el.tagName === 'link') {
      const href = $(el).attr('href');
      if (href && !href.startsWith('http')) {
        $(el).attr('href', new URL(href, url).toString());
      }
    } else {
      $(el).remove();
    }
  });
  BS_SITE_INFO = { name, assets: head.html(), url };
  return BS_SITE_INFO;
}

export async function userCodeInputSource(ctx, form, out, err) {
  // @param ctx - koa request context
  // @param form - form source (id="op.deviceInputForm") to be embedded in the page and submitted
  //   by the End-User.
  // @param out - if an error is returned the out object contains details that are fit to be
  //   rendered, i.e. does not include internal error messages
  // @param err - error object with an optional userCode property passed when the form is being
  //   re-rendered due to code missing/invalid/expired
  const bsInfo = BS_SITE_INFO || await fetchBlessingSkinSiteInfo();
  let msg;
  if (err && (err.userCode || err.name === 'NoCodeError')) {
    msg = '授权码无效或已过期，请重新输入。';
  } else if (err && err.name === 'AbortedError') {
    msg = '授权请求已被中断。';
  } else if (err) {
    msg = '处理请求时发生错误。';
  } else {
    msg = '';
  }
  const $ = cheerio.load(form);
  $('input').addClass('form-control');
  $('input').attr('placeholder', '输入应用中显示的授权码');
  form = `<div class="form-group">${$.html()}</div>`;
  renderFile(`${VIEWS_PATH}/user-code-input.ejs`, { bsInfo, form, msg }, (err, html) => {
    if (err) {
      ctx.throw(500, 'Error rendering view');
    } else {
      ctx.body = html;
    }
  });
}

export async function userCodeConfirmSource(ctx, form, client, deviceInfo, userCode) {
  // @param ctx - koa request context
  // @param form - form source (id="op.deviceConfirmForm") to be embedded in the page and
  //   submitted by the End-User.
  // @param deviceInfo - device information from the device_authorization_endpoint call
  // @param userCode - formatted user code by the configured mask
  const bsInfo = BS_SITE_INFO || await fetchBlessingSkinSiteInfo();
  renderFile(`${VIEWS_PATH}/user-code-confirm.ejs`, { bsInfo, clientName: ctx.oidc.client.clientName || ctx.oidc.client.clientId, userCode, form }, (err, html) => {
    if (err) {
      ctx.throw(500, 'Error rendering view');
    } else {
      ctx.body = html;
    }
  });
}

export async function successSource(ctx) {
  const bsInfo = BS_SITE_INFO || await fetchBlessingSkinSiteInfo();
  renderFile(`${VIEWS_PATH}/success.ejs`, { bsInfo }, (err, html) => {
    if (err) {
      ctx.throw(500, 'Error rendering view');
    } else {
      ctx.body = html;
    }
  });
}
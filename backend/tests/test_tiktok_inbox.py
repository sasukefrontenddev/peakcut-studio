"""A sandbox failure may deliver an inbox draft, never a fake published result."""
import os,sys,tempfile
from pathlib import Path
from unittest.mock import patch
os.environ.update(PEAKCUT_DATA=tempfile.mkdtemp(prefix='peakcut-inbox-'),DATABASE_URL='',PEAKCUT_ACCOUNTS='0',PEAKCUT_FETCH_MODEL='0',PEAKCUT_UPDATE_CHECK='0')
sys.path.insert(0,'.')
import httpx
from studio import accounts,posting,auth,db,ctx

db.init();auth.local_user()
p=Path(os.environ['PEAKCUT_DATA'])/'clip.mp4';p.write_bytes(b'test-video')
acc={'id':'tt_test','platform':'tiktok','name':'Test','scope':'user.info.basic,video.publish,video.upload'}
e=RuntimeError('Unaudited public account');e.code='unaudited_client_can_only_post_to_private_accounts'
calls=[]
def ttpost(acc,url,body,what):
 calls.append((url,body))
 return {'publish_id':'inbox-test','upload_url':'https://open-upload.tiktokapis.com/test'} if url.endswith('/init/') else {'status':'SEND_TO_USER_INBOX'}
with patch.object(accounts,'_tiktok_direct_upload',side_effect=e),patch.object(accounts,'_tt_post',side_effect=ttpost),patch.object(accounts.httpx,'put',return_value=httpx.Response(201)) as put:
 try:accounts.tiktok_upload(acc,p,'A caption','public');raise AssertionError('Draft counted as post')
 except accounts.TikTokInboxDelivered as done:assert done.publish_id=='inbox-test' and done.confirmed
 assert put.call_args.kwargs['headers']['Content-Range']=='bytes 0-9/10'
assert calls[0][0]=='/post/publish/inbox/video/init/' and 'post_info' not in calls[0][1]
with patch.object(accounts,'_tiktok_direct_upload',side_effect=e),patch.object(accounts,'_tt_post',side_effect=AssertionError('No upload without permission')):
 try:accounts.tiktok_upload({**acc,'scope':'video.publish'},p,'x');raise AssertionError('Missing scope accepted')
 except accounts.TikTokSetupRequired:pass
with ctx.as_user(auth._local.id):
 row={'id':'test','user':auth._local.id,'job':'job','clip':'clip','creator':'creator','account':'tt_test','status':'posting','tries':0,'due_at':0,'title':'Test'}
 with patch.object(posting.jobs,'get',return_value={'id':'job','creator':'creator','dir':str(p.parent),'clips':[{'id':'clip','status':'done','file':'clip.mp4','title':'Test'}]}),patch.object(posting.accounts,'get',return_value=acc),patch.object(posting.creators,'get',return_value={'privacy':'public','post_footer':''}),patch.object(posting.accounts,'tiktok_upload',side_effect=accounts.TikTokInboxDelivered('inbox-test')),patch.object(posting,'_save'),patch.object(posting,'_mirror'),patch.object(posting.creators,'log'):
  posting._post(row)
 assert row['status']=='needs_action' and 'posted_at' not in row and row['remote_id']=='inbox-test'
print('PASS public-account sandbox fallback, upload permission, real byte upload and separate draft queue state')

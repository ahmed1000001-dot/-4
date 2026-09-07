package com.school.canteen;
import android.app.Activity;import android.os.Bundle;import android.webkit.*;import android.content.*;import android.net.Uri;import android.widget.Toast;import java.io.*;import java.nio.charset.StandardCharsets;
public class MainActivity extends Activity{
 private WebView w;private DBHelper db;private String pending="";private static final int EXP=91,IMP=92;
 @Override public void onCreate(Bundle b){super.onCreate(b);db=new DBHelper(this);w=new WebView(this);setContentView(w);WebSettings s=w.getSettings();s.setJavaScriptEnabled(true);s.setAllowFileAccess(true);s.setDomStorageEnabled(true);w.addJavascriptInterface(new Bridge(),"AndroidDB");w.loadUrl("file:///android_asset/index.html");}
 public class Bridge{
  @JavascriptInterface public String getAllData(){return db.getAllData();}
  @JavascriptInterface public long addProduct(int c,String n,int cp,double sp,String note){return db.addProduct(c,n,cp,sp,note);}
  @JavascriptInterface public int updateProduct(long id,int c,String n,int cp,double sp,String note){return db.updateProduct(id,c,n,cp,sp,note);}
  @JavascriptInterface public int archiveProduct(long id){return db.archiveProduct(id);}@JavascriptInterface public int restoreProduct(long id){return db.restoreProduct(id);}
  @JavascriptInterface public long addSupplier(String n,String p,String note){return db.addSupplier(n,p,note);}@JavascriptInterface public int updateSupplier(long id,String n,String p,String note){return db.updateSupplier(id,n,p,note);}
  @JavascriptInterface public long addPurchaseInvoice(String j){return db.addPurchaseInvoice(j);}@JavascriptInterface public int deletePurchaseInvoice(long id){return db.deletePurchaseInvoice(id);}
  @JavascriptInterface public long saveDailySale(long id,String d,double a,String n){return db.saveDailySale(id,d,a,n);}@JavascriptInterface public int deleteDailySale(long id){return db.deleteDailySale(id);}
  @JavascriptInterface public long addPayment(String d,long s,double a,String n){return db.addPayment(d,s,a,n);}@JavascriptInterface public int updatePayment(long id,String d,long s,double a,String n){return db.updatePayment(id,d,s,a,n);}
  @JavascriptInterface public long addExpense(String d,String t,double a,String n){return db.addExpense(d,t,a,n);}@JavascriptInterface public int updateExpense(long id,String d,String t,double a,String n){return db.updateExpense(id,d,t,a,n);}
  @JavascriptInterface public long addWithdrawal(String d,String p,String k,double a,String n){return db.addWithdrawal(d,p,k,a,n);}@JavascriptInterface public int updateWithdrawal(long id,String d,String p,String k,double a,String n){return db.updateWithdrawal(id,d,p,k,a,n);}
  @JavascriptInterface public long addIncome(String d,String t,double a,String n){return db.addIncome(d,t,a,n);}@JavascriptInterface public int updateIncome(long id,String d,String t,double a,String n){return db.updateIncome(id,d,t,a,n);}
  @JavascriptInterface public int deleteSimple(String t,long id){return db.deleteSimple(t,id);}
  @JavascriptInterface public long saveInventory(String j){return db.saveInventory(j);}@JavascriptInterface public int deleteInventory(long id){return db.deleteInventory(id);}
  @JavascriptInterface public void exportBackup(){pending=db.backup();runOnUiThread(()->{Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("application/json");i.putExtra(Intent.EXTRA_TITLE,"canteen-pro-v4.6-backup.json");startActivityForResult(i,EXP);});}
  @JavascriptInterface public void importBackup(){runOnUiThread(()->{Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("application/json");startActivityForResult(i,IMP);});}
  @JavascriptInterface public void toast(String x){runOnUiThread(()->Toast.makeText(MainActivity.this,x,Toast.LENGTH_SHORT).show());}
 }
 @Override protected void onActivityResult(int r,int c,Intent data){super.onActivityResult(r,c,data);if(c!=RESULT_OK||data==null||data.getData()==null)return;Uri u=data.getData();try{if(r==EXP){try(OutputStream o=getContentResolver().openOutputStream(u)){o.write(pending.getBytes(StandardCharsets.UTF_8));}Toast.makeText(this,"تم حفظ النسخة الاحتياطية",Toast.LENGTH_SHORT).show();}else if(r==IMP){StringBuilder sb=new StringBuilder();try(BufferedReader br=new BufferedReader(new InputStreamReader(getContentResolver().openInputStream(u),StandardCharsets.UTF_8))){String line;while((line=br.readLine())!=null)sb.append(line);}boolean ok=db.restore(sb.toString());Toast.makeText(this,ok?"تم استرجاع البيانات":"ملف النسخة غير صالح",Toast.LENGTH_SHORT).show();if(ok)w.reload();}}catch(Exception e){Toast.makeText(this,"تعذر تنفيذ العملية",Toast.LENGTH_SHORT).show();}}
}

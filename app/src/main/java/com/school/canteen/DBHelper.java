package com.school.canteen;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import org.json.JSONArray;
import org.json.JSONObject;

public class DBHelper extends SQLiteOpenHelper {
    private static final String DB_NAME="canteen_pro_final.db";
    private static final int DB_VERSION=6;
    public DBHelper(Context c){super(c,DB_NAME,null,DB_VERSION);}

    @Override public void onCreate(SQLiteDatabase db){
        db.execSQL("CREATE TABLE products(id INTEGER PRIMARY KEY AUTOINCREMENT, code INTEGER UNIQUE, name TEXT NOT NULL UNIQUE, carton_pieces INTEGER NOT NULL DEFAULT 1, sale_price REAL NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, note TEXT)");
        db.execSQL("CREATE TABLE suppliers(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, phone TEXT, note TEXT, active INTEGER NOT NULL DEFAULT 1)");
        createTransactions(db);
        seedProducts(db); seedSuppliers(db);
    }

    private void createTransactions(SQLiteDatabase db){
        db.execSQL("CREATE TABLE purchase_invoices(id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, supplier_id INTEGER NOT NULL, invoice_total REAL NOT NULL DEFAULT 0, paid REAL NOT NULL DEFAULT 0, note TEXT)");
        db.execSQL("CREATE TABLE purchase_lines(id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_id INTEGER NOT NULL, product_id INTEGER NOT NULL, cartons REAL NOT NULL DEFAULT 0, carton_pieces INTEGER NOT NULL DEFAULT 1, sale_price REAL NOT NULL DEFAULT 0, purchase_total REAL NOT NULL DEFAULT 0, pieces INTEGER NOT NULL DEFAULT 0, expected_sales REAL NOT NULL DEFAULT 0, expected_profit REAL NOT NULL DEFAULT 0, profit_pct REAL NOT NULL DEFAULT 0)");
        db.execSQL("CREATE TABLE daily_sales(id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL UNIQUE, total REAL NOT NULL DEFAULT 0, note TEXT)");
        db.execSQL("CREATE TABLE supplier_payments(id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, supplier_id INTEGER NOT NULL, amount REAL NOT NULL DEFAULT 0, note TEXT)");
        db.execSQL("CREATE TABLE expenses(id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, type TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0, note TEXT)");
        db.execSQL("CREATE TABLE withdrawals(id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, person TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'نقدي', amount REAL NOT NULL DEFAULT 0, note TEXT)");
        db.execSQL("CREATE TABLE other_income(id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, type TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0, note TEXT)");
        db.execSQL("CREATE TABLE inventory_sessions(id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, from_date TEXT, to_date TEXT, note TEXT)");
        db.execSQL("CREATE TABLE inventory_lines(id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER NOT NULL, product_id INTEGER NOT NULL, qty INTEGER NOT NULL DEFAULT 0, sale_price REAL NOT NULL DEFAULT 0, value REAL NOT NULL DEFAULT 0)");
    }

    private void seedSuppliers(SQLiteDatabase db){
        ContentValues v=new ContentValues(); v.put("name","المورد الرئيسي"); db.insert("suppliers",null,v);
    }

    private void seedProducts(SQLiteDatabase db){
        Object[][] p={
          {16,"شيبسي 10",15,10.0},{17,"شيبسي 5",20,5.0},{18,"ذرة 5",12,5.0},{19,"كراتيه 5",12,5.0},
          {20,"كراتيه 10",10,10.0},{21,"دوريتوس 10 جنيه",15,10.0},{22,"دوريتوس 5 جنيه",20,5.0},
          {23,"بسكوت 5",12,5.0},{24,"عصير 5",27,5.0},{25,"عصير 6",27,6.0},{26,"لبان 1",20,1.0},
          {27,"مناديل 3",10,3.0},{28,"اندومي 5",40,5.0},{29,"اندومي 6 كوري",40,6.0},
          {30,"مياه معدنية صغيرة 6",20,6.0},{31,"كولا 5",12,5.0},{32,"كولا 6",12,6.0},
          {33,"كرانشي 10",15,10.0},{34,"كرانشي 5",20,5.0},{35,"فشار",12,5.0},{36,"كومبو",12,5.0},
          {37,"بريك",12,5.0},{38,"فوكس",12,5.0},{39,"تايجر",20,5.0},{40,"لوليتا",60,1.0}
        };
        for(Object[] r:p){
            ContentValues v=new ContentValues();
            v.put("code",(Integer)r[0]); v.put("name",(String)r[1]);
            v.put("carton_pieces",(Integer)r[2]); v.put("sale_price",(Double)r[3]); v.put("active",1);
            db.insert("products",null,v);
        }
    }

    @Override public void onUpgrade(SQLiteDatabase db,int oldV,int newV){
        // Preserve products/suppliers from v3, rebuild transaction logic to match the real workflow.
        String[] tx={"purchase_lines","purchase_invoices","sales","daily_sales","supplier_payments","expenses","withdrawals","other_income","daily_opening","inventory_lines","inventory_sessions"};
        for(String t:tx) db.execSQL("DROP TABLE IF EXISTS "+t);
        // products in older version had min_stock; keeping it is harmless. New code does not rely on it.
        createTransactions(db);
    }

    private double scalar(String sql,String[] args){
        Cursor c=getReadableDatabase().rawQuery(sql,args);
        try{return c.moveToFirst()?c.getDouble(0):0;}finally{c.close();}
    }

    public long addProduct(int code,String name,int carton,double sale,String note){
        ContentValues v=new ContentValues();v.put("code",code);v.put("name",name);v.put("carton_pieces",carton);v.put("sale_price",sale);v.put("note",note);v.put("active",1);
        return getWritableDatabase().insert("products",null,v);
    }
    public int updateProduct(long id,int code,String name,int carton,double sale,String note){
        ContentValues v=new ContentValues();v.put("code",code);v.put("name",name);v.put("carton_pieces",carton);v.put("sale_price",sale);v.put("note",note);
        return getWritableDatabase().update("products",v,"id=?",new String[]{""+id});
    }
    public int archiveProduct(long id){ContentValues v=new ContentValues();v.put("active",0);return getWritableDatabase().update("products",v,"id=?",new String[]{""+id});}
    public int restoreProduct(long id){ContentValues v=new ContentValues();v.put("active",1);return getWritableDatabase().update("products",v,"id=?",new String[]{""+id});}

    public long addSupplier(String name,String phone,String note){
        ContentValues v=new ContentValues();v.put("name",name);v.put("phone",phone);v.put("note",note);v.put("active",1);
        return getWritableDatabase().insertWithOnConflict("suppliers",null,v,SQLiteDatabase.CONFLICT_IGNORE);
    }
    public int updateSupplier(long id,String name,String phone,String note){
        ContentValues v=new ContentValues();v.put("name",name);v.put("phone",phone);v.put("note",note);
        return getWritableDatabase().update("suppliers",v,"id=?",new String[]{""+id});
    }

    public long addPurchaseInvoice(String json){
        SQLiteDatabase db=getWritableDatabase();db.beginTransaction();
        try{
            JSONObject o=new JSONObject(json); JSONArray lines=o.getJSONArray("lines");
            double invoiceTotal=0;
            for(int i=0;i<lines.length();i++) invoiceTotal+=lines.getJSONObject(i).getDouble("purchase_total");
            ContentValues h=new ContentValues();
            h.put("date",o.getString("date"));h.put("supplier_id",o.getLong("supplier_id"));
            h.put("invoice_total",invoiceTotal);h.put("paid",o.optDouble("paid",0));h.put("note",o.optString("note",""));
            long iid=db.insertOrThrow("purchase_invoices",null,h);

            for(int i=0;i<lines.length();i++){
                JSONObject x=lines.getJSONObject(i); int pid=x.getInt("product_id");
                double cartons=x.getDouble("cartons"), purchaseTotal=x.getDouble("purchase_total");
                int cp=(int)scalar("SELECT carton_pieces FROM products WHERE id=?",new String[]{""+pid});
                double sp=scalar("SELECT sale_price FROM products WHERE id=?",new String[]{""+pid});
                int pieces=(int)Math.round(cartons*cp);
                double expectedSales=pieces*sp, expectedProfit=expectedSales-purchaseTotal;
                double pct=purchaseTotal>0?(expectedProfit/purchaseTotal*100.0):0;
                ContentValues l=new ContentValues();
                l.put("invoice_id",iid);l.put("product_id",pid);l.put("cartons",cartons);
                l.put("carton_pieces",cp);l.put("sale_price",sp);l.put("purchase_total",purchaseTotal);
                l.put("pieces",pieces);l.put("expected_sales",expectedSales);l.put("expected_profit",expectedProfit);l.put("profit_pct",pct);
                db.insertOrThrow("purchase_lines",null,l);
            }
            db.setTransactionSuccessful(); return iid;
        }catch(Exception e){return -1;}finally{db.endTransaction();}
    }
    public int deletePurchaseInvoice(long id){
        SQLiteDatabase db=getWritableDatabase();db.beginTransaction();
        try{db.delete("purchase_lines","invoice_id=?",new String[]{""+id});int r=db.delete("purchase_invoices","id=?",new String[]{""+id});db.setTransactionSuccessful();return r;}finally{db.endTransaction();}
    }

    public long saveDailySale(long id,String date,double total,String note){
        SQLiteDatabase db=getWritableDatabase();
        if(id<=0){
            long existing=(long)scalar("SELECT COALESCE(MAX(id),0) FROM daily_sales WHERE date=?",new String[]{date});
            if(existing>0) id=existing;
        }
        ContentValues v=new ContentValues();v.put("date",date);v.put("total",total);v.put("note",note);
        if(id>0){db.update("daily_sales",v,"id=?",new String[]{""+id});return id;}
        return db.insert("daily_sales",null,v);
    }
    public int deleteDailySale(long id){return getWritableDatabase().delete("daily_sales","id=?",new String[]{""+id});}

    public long addPayment(String d,long sid,double a,String n){ContentValues v=new ContentValues();v.put("date",d);v.put("supplier_id",sid);v.put("amount",a);v.put("note",n);return getWritableDatabase().insert("supplier_payments",null,v);}
    public int updatePayment(long id,String d,long sid,double a,String n){ContentValues v=new ContentValues();v.put("date",d);v.put("supplier_id",sid);v.put("amount",a);v.put("note",n);return getWritableDatabase().update("supplier_payments",v,"id=?",new String[]{""+id});}

    private long addSimple(String table,String date,String key,String val,double amount,String note){
        ContentValues v=new ContentValues();v.put("date",date);v.put(key,val);v.put("amount",amount);v.put("note",note);
        return getWritableDatabase().insert(table,null,v);
    }
    public long addExpense(String d,String t,double a,String n){return addSimple("expenses",d,"type",t,a,n);}
    public int updateExpense(long id,String d,String t,double a,String n){ContentValues v=new ContentValues();v.put("date",d);v.put("type",t);v.put("amount",a);v.put("note",n);return getWritableDatabase().update("expenses",v,"id=?",new String[]{""+id});}
    public long addWithdrawal(String d,String p,String kind,double a,String n){ContentValues v=new ContentValues();v.put("date",d);v.put("person",p);v.put("kind",kind);v.put("amount",a);v.put("note",n);return getWritableDatabase().insert("withdrawals",null,v);}
    public int updateWithdrawal(long id,String d,String p,String kind,double a,String n){ContentValues v=new ContentValues();v.put("date",d);v.put("person",p);v.put("kind",kind);v.put("amount",a);v.put("note",n);return getWritableDatabase().update("withdrawals",v,"id=?",new String[]{""+id});}
    public long addIncome(String d,String t,double a,String n){return addSimple("other_income",d,"type",t,a,n);}
    public int updateIncome(long id,String d,String t,double a,String n){ContentValues v=new ContentValues();v.put("date",d);v.put("type",t);v.put("amount",a);v.put("note",n);return getWritableDatabase().update("other_income",v,"id=?",new String[]{""+id});}
    public int deleteSimple(String table,long id){
        if(!(table.equals("supplier_payments")||table.equals("expenses")||table.equals("withdrawals")||table.equals("other_income")))return 0;
        return getWritableDatabase().delete(table,"id=?",new String[]{""+id});
    }

    public long saveInventory(String json){
        SQLiteDatabase db=getWritableDatabase();db.beginTransaction();
        try{
            JSONObject o=new JSONObject(json);
            ContentValues h=new ContentValues();h.put("date",o.getString("date"));h.put("from_date",o.optString("from_date",""));h.put("to_date",o.optString("to_date",""));h.put("note",o.optString("note",""));
            long sid=db.insertOrThrow("inventory_sessions",null,h);
            JSONArray lines=o.getJSONArray("lines");
            for(int i=0;i<lines.length();i++){
                JSONObject x=lines.getJSONObject(i);int pid=x.getInt("product_id"), qty=x.getInt("qty");
                double sp=scalar("SELECT sale_price FROM products WHERE id=?",new String[]{""+pid});
                ContentValues l=new ContentValues();l.put("session_id",sid);l.put("product_id",pid);l.put("qty",qty);l.put("sale_price",sp);l.put("value",qty*sp);
                db.insertOrThrow("inventory_lines",null,l);
            }
            db.setTransactionSuccessful();return sid;
        }catch(Exception e){return -1;}finally{db.endTransaction();}
    }
    public int deleteInventory(long id){
        SQLiteDatabase db=getWritableDatabase();db.beginTransaction();
        try{db.delete("inventory_lines","session_id=?",new String[]{""+id});int r=db.delete("inventory_sessions","id=?",new String[]{""+id});db.setTransactionSuccessful();return r;}finally{db.endTransaction();}
    }

    private JSONArray query(String sql,String[] args)throws Exception{
        JSONArray a=new JSONArray();Cursor c=getReadableDatabase().rawQuery(sql,args);
        try{
            String[] cols=c.getColumnNames();
            while(c.moveToNext()){
                JSONObject o=new JSONObject();
                for(int i=0;i<cols.length;i++){
                    int t=c.getType(i);
                    if(t==Cursor.FIELD_TYPE_INTEGER)o.put(cols[i],c.getLong(i));
                    else if(t==Cursor.FIELD_TYPE_FLOAT)o.put(cols[i],c.getDouble(i));
                    else if(t==Cursor.FIELD_TYPE_NULL)o.put(cols[i],"");
                    else o.put(cols[i],c.getString(i));
                }
                a.put(o);
            }
        }finally{c.close();}
        return a;
    }

    public String getAllData(){
        try{
            JSONObject o=new JSONObject();
            o.put("products",query("SELECT id,code,name,carton_pieces,sale_price,active,note FROM products ORDER BY active DESC,code",null));
            o.put("suppliers",query("SELECT s.*,COALESCE((SELECT SUM(invoice_total) FROM purchase_invoices i WHERE i.supplier_id=s.id),0) invoices_total,COALESCE((SELECT SUM(paid) FROM purchase_invoices i WHERE i.supplier_id=s.id),0) invoice_paid,COALESCE((SELECT SUM(amount) FROM supplier_payments p WHERE p.supplier_id=s.id),0) later_paid FROM suppliers s ORDER BY s.name",null));
            o.put("purchases",query("SELECT i.id,i.date,i.supplier_id,s.name supplier,i.invoice_total,i.paid,(i.invoice_total-i.paid) invoice_remaining,i.note,COALESCE((SELECT SUM(expected_sales) FROM purchase_lines l WHERE l.invoice_id=i.id),0) expected_sales,COALESCE((SELECT SUM(expected_profit) FROM purchase_lines l WHERE l.invoice_id=i.id),0) expected_profit FROM purchase_invoices i JOIN suppliers s ON s.id=i.supplier_id ORDER BY i.date DESC,i.id DESC",null));
            o.put("purchase_lines",query("SELECT l.*,p.name product,p.code FROM purchase_lines l JOIN products p ON p.id=l.product_id ORDER BY l.id",null));
            o.put("daily_sales",query("SELECT * FROM daily_sales ORDER BY date DESC,id DESC",null));
            o.put("payments",query("SELECT p.*,s.name supplier FROM supplier_payments p JOIN suppliers s ON s.id=p.supplier_id ORDER BY p.date DESC,p.id DESC",null));
            o.put("expenses",query("SELECT * FROM expenses ORDER BY date DESC,id DESC",null));
            o.put("withdrawals",query("SELECT * FROM withdrawals ORDER BY date DESC,id DESC",null));
            o.put("income",query("SELECT * FROM other_income ORDER BY date DESC,id DESC",null));
            o.put("inventories",query("SELECT s.*,COALESCE((SELECT SUM(value) FROM inventory_lines l WHERE l.session_id=s.id),0) total_value FROM inventory_sessions s ORDER BY s.date DESC,s.id DESC",null));
            o.put("inventory_lines",query("SELECT l.*,p.name product,p.code FROM inventory_lines l JOIN products p ON p.id=l.product_id ORDER BY l.session_id,l.id",null));
            return o.toString();
        }catch(Exception e){return "{}";}
    }

    public String backup(){return getAllData();}
    public boolean restore(String json){
        SQLiteDatabase db=getWritableDatabase();db.beginTransaction();
        try{
            JSONObject o=new JSONObject(json);
            String[] t={"inventory_lines","inventory_sessions","purchase_lines","purchase_invoices","daily_sales","supplier_payments","expenses","withdrawals","other_income","products","suppliers"};
            for(String x:t)db.delete(x,null,null);
            insertArray(db,"products",o.getJSONArray("products"),new String[]{"id","code","name","carton_pieces","sale_price","active","note"});
            insertArray(db,"suppliers",o.getJSONArray("suppliers"),new String[]{"id","name","phone","note","active"});
            insertArray(db,"purchase_invoices",o.getJSONArray("purchases"),new String[]{"id","date","supplier_id","invoice_total","paid","note"});
            insertArray(db,"purchase_lines",o.getJSONArray("purchase_lines"),new String[]{"id","invoice_id","product_id","cartons","carton_pieces","sale_price","purchase_total","pieces","expected_sales","expected_profit","profit_pct"});
            insertArray(db,"daily_sales",o.getJSONArray("daily_sales"),new String[]{"id","date","total","note"});
            insertArray(db,"supplier_payments",o.getJSONArray("payments"),new String[]{"id","date","supplier_id","amount","note"});
            insertArray(db,"expenses",o.getJSONArray("expenses"),new String[]{"id","date","type","amount","note"});
            insertArray(db,"withdrawals",o.getJSONArray("withdrawals"),new String[]{"id","date","person","kind","amount","note"});
            insertArray(db,"other_income",o.getJSONArray("income"),new String[]{"id","date","type","amount","note"});
            insertArray(db,"inventory_sessions",o.getJSONArray("inventories"),new String[]{"id","date","from_date","to_date","note"});
            insertArray(db,"inventory_lines",o.getJSONArray("inventory_lines"),new String[]{"id","session_id","product_id","qty","sale_price","value"});
            db.setTransactionSuccessful();return true;
        }catch(Exception e){return false;}finally{db.endTransaction();}
    }
    private void insertArray(SQLiteDatabase db,String table,JSONArray a,String[] cols)throws Exception{
        for(int i=0;i<a.length();i++){
            JSONObject o=a.getJSONObject(i);ContentValues v=new ContentValues();
            for(String c:cols){
                if(!o.has(c)||o.isNull(c))continue;Object x=o.get(c);
                if(x instanceof Integer)v.put(c,(Integer)x);
                else if(x instanceof Long)v.put(c,(Long)x);
                else if(x instanceof Double)v.put(c,(Double)x);
                else v.put(c,String.valueOf(x));
            }
            db.insert(table,null,v);
        }
    }
}

/**
 * إدارة وتخزين ملفات الامتحانات الشهرية (النسخة غير المحلولة والنسخة المحلولة)
 * سنتر مستر حسين
 */

const ExamStore = {
  BUCKET_NAME: 'exam-images',
  FILE_NAME: 'exam_materials_registry.json',
  CACHE_KEY: 'mrhussien_exam_materials_cache',

  // جلب جميع ملفات الامتحانات لجميع الشهور
  async getAllExamMaterials(supabaseClient) {
    // 1. فحص الكاش المحلي أولاً للسرعة
    let cached = [];
    try {
      cached = JSON.parse(localStorage.getItem(this.CACHE_KEY) || '[]');
    } catch {}

    if (!supabaseClient) return cached;

    try {
      // 2. محاولة تنزيل السجل المحدث من Supabase Storage
      const { data, error } = await supabaseClient.storage
        .from(this.BUCKET_NAME)
        .download(this.FILE_NAME);

      if (!error && data) {
        const text = await data.text();
        const json = JSON.parse(text);
        if (Array.isArray(json)) {
          localStorage.setItem(this.CACHE_KEY, JSON.stringify(json));
          return json;
        }
      }
    } catch (e) {
      console.warn('Using cached exam materials:', e);
    }

    return cached;
  },

  // حفظ امتحان جديد أو تحديثه (نسخة غير محلولة + نسخة محلولة)
  async saveExamMaterials(supabaseClient, examRecord) {
    // جلب القائمة الحالية
    const list = await this.getAllExamMaterials(supabaseClient);

    // التحقق هل يوجد امتحان بنفس الشهر والعنوان لتحديثه
    const existingIndex = list.findIndex(
      x => x.month_key === examRecord.month_key && x.title === examRecord.title
    );

    const updatedRecord = {
      ...examRecord,
      updated_at: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      list[existingIndex] = updatedRecord;
    } else {
      list.unshift(updatedRecord);
    }

    // حفظ في الكاش المحلي فوراً
    localStorage.setItem(this.CACHE_KEY, JSON.stringify(list));

    // رفع السجل إلى Supabase Storage كملف JSON عام
    if (supabaseClient) {
      try {
        const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
        await supabaseClient.storage
          .from(this.BUCKET_NAME)
          .upload(this.FILE_NAME, blob, { upsert: true });
      } catch (err) {
        console.error('Failed to sync registry to cloud storage:', err);
      }
    }

    return list;
  },

  // رفع ملف PDF واحد وإرجاع رابطه المباشر
  async uploadPdfFile(supabaseClient, file, folder = 'general') {
    if (!file) return null;
    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `pdfs/${folder}/${Date.now()}_${cleanName}`;

    const { error } = await supabaseClient.storage
      .from(this.BUCKET_NAME)
      .upload(path, file, { upsert: true, contentType: 'application/pdf' });

    if (error) throw error;

    const { data } = supabaseClient.storage.from(this.BUCKET_NAME).getPublicUrl(path);
    return data.publicUrl;
  },

  // حذف امتحان من السجل
  async deleteExamMaterials(supabaseClient, monthKey, title) {
    let list = await this.getAllExamMaterials(supabaseClient);
    list = list.filter(x => !(x.month_key === monthKey && x.title === title));
    localStorage.setItem(this.CACHE_KEY, JSON.stringify(list));

    if (supabaseClient) {
      try {
        const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
        await supabaseClient.storage
          .from(this.BUCKET_NAME)
          .upload(this.FILE_NAME, blob, { upsert: true });
      } catch (err) {
        console.error('Failed to update registry:', err);
      }
    }
    return list;
  }
};

window.ExamStore = ExamStore;

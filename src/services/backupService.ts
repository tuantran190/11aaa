import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import mongoose from 'mongoose';

export const startBackupCron = () => {
  // Chạy tự động backup định kỳ 1 ngày/lần (lúc 00:00 hàng ngày)
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('Bắt đầu tự động backup dữ liệu (Cronjob)...');
      await executeBackup();
    } catch (error) {
      console.error('Lỗi khi chạy cronjob backup dữ liệu:', error);
    }
  });
  // console.log('Đã cấu hình Cronjob: Tự động backup lúc 00:00 hàng ngày.');
};

export const executeBackup = async () => {
  try {
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupData: any = {};
    const models = mongoose.modelNames();
    
    for (const modelName of models) {
      const Model = mongoose.model(modelName);
      backupData[modelName] = await Model.find({});
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const timestamp = Date.now();
    const filename = `backup-${dateStr}-${timestamp}.json`;
    const filePath = path.join(backupDir, filename);
    
    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));
    console.log(`Backup thủ công/tự động thành công: ${filename}`);
    
    return {
      success: true,
      filename,
      size: fs.statSync(filePath).size,
      path: filePath
    };
  } catch (error) {
    console.error('❌ Lỗi khi backup dữ liệu:', error);
    throw error;
  }
};

export const getBackupsList = () => {
  try {
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      return [];
    }
    
    const files = fs.readdirSync(backupDir);
    return files
      .filter(f => f.endsWith('.json'))
      .map(filename => {
        const filePath = path.join(backupDir, filename);
        const stats = fs.statSync(filePath);
        return {
          filename,
          size: stats.size,
          createdAt: stats.birthtime
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    console.error('Lỗi khi lấy danh sách backup:', error);
    return [];
  }
};

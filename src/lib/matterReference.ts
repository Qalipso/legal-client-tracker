import type { ReferenceData } from "../types/client";

// Static mirror of supabase/migrations/004_matter_model.sql seed rows —
// used by the localStorage (demo-mode) provider where there is no DB.
export const DEMO_REFERENCE_DATA: ReferenceData = {
  matterTypes: [
    { code: "contract", label: "Договор" },
    { code: "claim", label: "Претензия" },
    { code: "litigation", label: "Суд" },
    { code: "consultation", label: "Консультация" },
    { code: "corporate", label: "Корпоративное" },
    { code: "migration", label: "Миграционное" },
  ],
  matterStages: [
    { code: "intake", label: "Новое обращение" },
    { code: "preparation", label: "Подготовка документов" },
    { code: "sent", label: "Направлено контрагенту" },
    { code: "review", label: "На рассмотрении" },
    { code: "litigation", label: "Судебное разбирательство" },
    { code: "enforcement", label: "Исполнение решения" },
    { code: "closed", label: "Завершено" },
  ],
  documentTypes: [
    { code: "contract", label: "Договор" },
    { code: "claim", label: "Претензия" },
    { code: "lawsuit", label: "Исковое заявление" },
    { code: "power_of_attorney", label: "Доверенность" },
    { code: "id_document", label: "Паспорт / удостоверение" },
    { code: "court_act", label: "Судебный акт" },
    { code: "correspondence", label: "Переписка" },
    { code: "other", label: "Прочее" },
  ],
  documentStatuses: [
    { code: "draft", label: "Черновик" },
    { code: "in_preparation", label: "На подготовке" },
    { code: "sent", label: "Отправлен" },
    { code: "signed", label: "Подписан" },
    { code: "under_review", label: "На проверке" },
    { code: "approved", label: "Утверждён" },
    { code: "archived", label: "Архив" },
  ],
  deadlineTypes: [
    { code: "procedural", label: "Процессуальный срок" },
    { code: "claim_response", label: "Срок ответа на претензию" },
    { code: "contract_performance", label: "Срок исполнения договора" },
    { code: "payment", label: "Срок оплаты" },
    { code: "internal", label: "Внутренний дедлайн" },
  ],
};

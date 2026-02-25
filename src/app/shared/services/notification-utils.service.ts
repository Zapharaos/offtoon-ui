import {Injectable} from '@angular/core';
import {ConfirmationService, MessageService} from "primeng/api";
import {TranslateService} from "@ngx-translate/core";

@Injectable({
  providedIn: 'root'
})
export class NotificationUtilsService {
  constructor(private messageService: MessageService,
              private translateService: TranslateService,
              private confirmationService: ConfirmationService) {
  }

  showToastErrorWithTranslate(message: string, error?: any, life: number = 4000) {
    this.showToastError(this.translateService.instant(message), error, life);
  }

  showToastError(message: string, error?: any, life: number = 4000) {
    let detail = message;
    if (error?.error?.message) {
      detail += ` (${error.error.message})`;
    }

    this.messageService.add({
      key: 'main-toast',
      severity: 'error',
      detail,
      life
    });
  }

  showToastSuccessWithTranslate(message: string, life : number = 4000) {
    this.showToastSuccess(this.translateService.instant(message), life);
  }

  showToastSuccess(message: string, life: number = 4000) {
    this.messageService.add({
      key: 'main-toast',
      severity: 'success',
      detail: message,
      life,
    });
  }

  showToastWarningWithTranslate(message: string, life: number = 4000) {
    this.showToastWarning(this.translateService.instant(message), life);
  }

  showToastWarning(message: string, life: number = 4000) {
    this.messageService.add({
      key: 'main-toast',
      severity: 'warn',
      detail: message,
      life,
    });
  }

  showToastInfoWithTranslate(message: string, life: number = 4000) {
    this.showToastInfo(this.translateService.instant(message), life);
  }

  showToastInfo(message: string, life: number = 4000) {
    this.messageService.add({
      key: 'main-toast',
      severity: 'info',
      detail: message,
      life,
    });
  }

  showDeleteConfirmation(accept?: () => void, reject?: () => void, message?: string, header?: string) {
    this.confirmationService.confirm({
      message: message ?? this.translateService.instant('modal.delete.message'),
      header: header ?? this.translateService.instant('modal.delete.title'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: "p-button-danger p-button-text",
      rejectButtonStyleClass: "p-button-text p-button-text",
      acceptIcon: "none",
      rejectIcon: "none",
      acceptLabel: this.translateService.instant('modal.delete.confirm'),
      rejectLabel: this.translateService.instant('modal.delete.cancel'),
      accept: accept,
      reject: reject
    });
  }

  showYesNoConfirmationDialog(message: string, header: string, yes?: () => void, no?: () => void) {
    this.confirmationService.confirm({
      message, header,
      icon: 'pi pi-question-circle',
      acceptButtonStyleClass: "p-button-primary p-button-text",
      rejectButtonStyleClass: "p-button-secondary p-button-text",
      acceptIcon: "none",
      rejectIcon: "none",
      acceptLabel: this.translateService.instant('messages.yes'),
      rejectLabel: this.translateService.instant('messages.no'),
      accept: yes,
      reject: no,
      closable: false
    });
  }

}

import { defineDict } from "../core";

/** Roles and permission errors (workspace members: owner, manager, staff). */
export const access = defineDict({
  en: {
    roleOwner: "Owner",
    roleManager: "Manager",
    roleStaff: "Staff",
    signOut: "Sign out",
    forbidden: "You do not have permission to do this. Ask an owner or manager.",
    forbiddenDecide: "This item is not assigned to you. Only its assignee, a manager or an owner can decide it.",
    memberDisabled: "Your access to this workspace has been turned off.",
    noWorkspace: "You are not a member of any workspace yet. Ask an owner to invite you.",
  },
  vi: {
    roleOwner: "Chủ sở hữu",
    roleManager: "Quản lý",
    roleStaff: "Nhân viên",
    signOut: "Đăng xuất",
    forbidden: "Bạn không có quyền thực hiện thao tác này. Hãy nhờ chủ sở hữu hoặc quản lý.",
    forbiddenDecide: "Việc này không được giao cho bạn. Chỉ người được giao, quản lý hoặc chủ sở hữu mới quyết định được.",
    memberDisabled: "Quyền truy cập workspace của bạn đã bị tắt.",
    noWorkspace: "Bạn chưa thuộc workspace nào. Hãy nhờ chủ sở hữu mời bạn.",
  },
});

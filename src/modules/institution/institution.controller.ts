import { Request, Response, NextFunction } from "express";
import { zodValidation } from "../../utils/zod.util";
import {
  CollegeResponseItem,
  CollegesListResponse,
  CreateCollege,
  createCollegeSchema,
  CreateDepartment,
  createDepartmentSchema,
  CreateUniversity,
  createUniversitySchema,
  DepartmentsListResponse,
  DepartmentResponseItem,
  GetCollegesQuery,
  getCollegesQuerySchema,
  GetDepartmentsQuery,
  getDepartmentsQuerySchema,
  GetUniversitiesQuery,
  getUniversitiesQuerySchema,
  IdParam,
  idParamSchema,
  MessageResponse,
  UpdateCollege,
  updateCollegeSchema,
  UpdateDepartment,
  updateDepartmentSchema,
  UpdateUniversity,
  updateUniversitySchema,
  UniversitiesListResponse,
  UniversityResponseItem,
  StringObject,
} from "./institution.interface";
import AppError from "../../utils/appError";
import { prisma } from "../../config/prisma";

class InstitutionController {
  public getUniversities = async (
    req: Request<
      StringObject,
      StringObject,
      StringObject,
      GetUniversitiesQuery
    >,
    res: Response<UniversitiesListResponse>,
    _next: NextFunction,
  ) => {
    const query = zodValidation(getUniversitiesQuerySchema, req.query);

    const universities = await prisma.university.findMany({
      where: {
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { code: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(typeof query.isActive === "boolean"
          ? { isActive: query.isActive }
          : {}),
      },
      orderBy: { name: "asc" },
    });

    res.status(200).json({
      success: true,
      message: "Universities fetched successfully.",
      results: universities.length,
      universities,
    });
  };

  public getColleges = async (
    req: Request<StringObject, StringObject, StringObject, GetCollegesQuery>,
    res: Response<CollegesListResponse>,
    _next: NextFunction,
  ) => {
    const query = zodValidation(getCollegesQuerySchema, req.query);

    const colleges = await prisma.college.findMany({
      where: {
        ...(query.universityId ? { universityId: query.universityId } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { code: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
    });

    res.status(200).json({
      success: true,
      message: "Colleges fetched successfully.",
      results: colleges.length,
      colleges,
    });
  };

  public getDepartments = async (
    req: Request<StringObject, StringObject, StringObject, GetDepartmentsQuery>,
    res: Response<DepartmentsListResponse>,
    _next: NextFunction,
  ) => {
    const query = zodValidation(getDepartmentsQuerySchema, req.query);

    const departments = await prisma.department.findMany({
      where: {
        ...(query.collegeId ? { collegeId: query.collegeId } : {}),
        ...(query.universityId
          ? { college: { universityId: query.universityId } }
          : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { code: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
    });

    res.status(200).json({
      success: true,
      message: "Departments fetched successfully.",
      results: departments.length,
      departments,
    });
  };

  public createUniversity = async (
    req: Request<StringObject, StringObject, CreateUniversity>,
    res: Response<MessageResponse & { university: UniversityResponseItem }>,
    _next: NextFunction,
  ) => {
    const payload = zodValidation(createUniversitySchema, req.body);

    const university = await prisma.university.create({
      data: {
        name: payload.name,
        code: payload.code,
        country: payload.country,
        apiEndpoint: payload.apiEndpoint,
        isActive: payload.isActive ?? true,
      },
    });

    res.status(201).json({
      success: true,
      message: "University created successfully.",
      university,
    });
  };

  public updateUniversity = async (
    req: Request<IdParam, StringObject, UpdateUniversity>,
    res: Response<MessageResponse & { university: UniversityResponseItem }>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);
    const payload = zodValidation(updateUniversitySchema, req.body);

    const existing = await prisma.university.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      throw new AppError("University not found.", 404);
    }

    const university = await prisma.university.update({
      where: { id: params.id },
      data: {
        ...(payload.name ? { name: payload.name } : {}),
        ...(payload.code ? { code: payload.code } : {}),
        ...(payload.country !== undefined ? { country: payload.country } : {}),
        ...(payload.apiEndpoint !== undefined
          ? { apiEndpoint: payload.apiEndpoint }
          : {}),
        ...(typeof payload.isActive === "boolean"
          ? { isActive: payload.isActive }
          : {}),
      },
    });

    res.status(200).json({
      success: true,
      message: "University updated successfully.",
      university,
    });
  };

  public deleteUniversity = async (
    req: Request<IdParam>,
    res: Response<MessageResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const existing = await prisma.university.findUnique({
      where: { id: params.id },
      include: {
        colleges: { select: { id: true } },
        users: { select: { id: true } },
        projects: { select: { id: true } },
      },
    });

    if (!existing) {
      throw new AppError("University not found.", 404);
    }

    if (
      existing.colleges.length ||
      existing.users.length ||
      existing.projects.length
    ) {
      throw new AppError(
        "Cannot delete university with linked colleges, users, or projects.",
        400,
      );
    }

    await prisma.university.delete({
      where: { id: params.id },
    });

    res.status(200).json({
      success: true,
      message: "University deleted successfully.",
    });
  };

  public createCollege = async (
    req: Request<StringObject, StringObject, CreateCollege>,
    res: Response<MessageResponse & { college: CollegeResponseItem }>,
    _next: NextFunction,
  ) => {
    const payload = zodValidation(createCollegeSchema, req.body);

    const university = await prisma.university.findUnique({
      where: { id: payload.universityId },
      select: { id: true },
    });

    if (!university) {
      throw new AppError("University not found.", 404);
    }

    const college = await prisma.college.create({
      data: {
        name: payload.name,
        code: payload.code,
        universityId: payload.universityId,
      },
    });

    res.status(201).json({
      success: true,
      message: "College created successfully.",
      college,
    });
  };

  public updateCollege = async (
    req: Request<IdParam, StringObject, UpdateCollege>,
    res: Response<MessageResponse & { college: CollegeResponseItem }>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);
    const payload = zodValidation(updateCollegeSchema, req.body);

    const existing = await prisma.college.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError("College not found.", 404);
    }

    if (payload.universityId) {
      const university = await prisma.university.findUnique({
        where: { id: payload.universityId },
        select: { id: true },
      });

      if (!university) {
        throw new AppError("University not found.", 404);
      }
    }

    const college = await prisma.college.update({
      where: { id: params.id },
      data: {
        ...(payload.name ? { name: payload.name } : {}),
        ...(payload.code ? { code: payload.code } : {}),
        ...(payload.universityId ? { universityId: payload.universityId } : {}),
      },
    });

    res.status(200).json({
      success: true,
      message: "College updated successfully.",
      college,
    });
  };

  public deleteCollege = async (
    req: Request<IdParam>,
    res: Response<MessageResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const existing = await prisma.college.findUnique({
      where: { id: params.id },
      include: {
        departments: { select: { id: true } },
        users: { select: { id: true } },
      },
    });

    if (!existing) {
      throw new AppError("College not found.", 404);
    }

    if (existing.departments.length || existing.users.length) {
      throw new AppError(
        "Cannot delete college with linked departments or users.",
        400,
      );
    }

    await prisma.college.delete({
      where: { id: params.id },
    });

    res.status(200).json({
      success: true,
      message: "College deleted successfully.",
    });
  };

  public createDepartment = async (
    req: Request<StringObject, StringObject, CreateDepartment>,
    res: Response<MessageResponse & { department: DepartmentResponseItem }>,
    _next: NextFunction,
  ) => {
    const payload = zodValidation(createDepartmentSchema, req.body);

    const college = await prisma.college.findUnique({
      where: { id: payload.collegeId },
      select: { id: true },
    });

    if (!college) {
      throw new AppError("College not found.", 404);
    }

    const department = await prisma.department.create({
      data: {
        name: payload.name,
        code: payload.code,
        collegeId: payload.collegeId,
      },
    });

    res.status(201).json({
      success: true,
      message: "Department created successfully.",
      department,
    });
  };

  public updateDepartment = async (
    req: Request<IdParam, StringObject, UpdateDepartment>,
    res: Response<MessageResponse & { department: DepartmentResponseItem }>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);
    const payload = zodValidation(updateDepartmentSchema, req.body);

    const existing = await prisma.department.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError("Department not found.", 404);
    }

    if (payload.collegeId) {
      const college = await prisma.college.findUnique({
        where: { id: payload.collegeId },
        select: { id: true },
      });

      if (!college) {
        throw new AppError("College not found.", 404);
      }
    }

    const department = await prisma.department.update({
      where: { id: params.id },
      data: {
        ...(payload.name ? { name: payload.name } : {}),
        ...(payload.code ? { code: payload.code } : {}),
        ...(payload.collegeId ? { collegeId: payload.collegeId } : {}),
      },
    });

    res.status(200).json({
      success: true,
      message: "Department updated successfully.",
      department,
    });
  };

  public deleteDepartment = async (
    req: Request<IdParam>,
    res: Response<MessageResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const existing = await prisma.department.findUnique({
      where: { id: params.id },
      include: {
        users: { select: { id: true } },
      },
    });

    if (!existing) {
      throw new AppError("Department not found.", 404);
    }

    if (existing.users.length) {
      throw new AppError("Cannot delete department with linked users.", 400);
    }

    await prisma.department.delete({
      where: { id: params.id },
    });

    res.status(200).json({
      success: true,
      message: "Department deleted successfully.",
    });
  };
}

export const institutionController = new InstitutionController();

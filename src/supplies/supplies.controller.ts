import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestWithAuth } from '../auth/decorators/current-user.decorator';
import { SuppliesService } from './supplies.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { CatalogQueryDto } from './dto/catalog-query.dto';
import { RequestProductImageUploadDto } from './dto/request-product-image-upload.dto';

@Controller()
export class AdminSuppliesController {
  constructor(private readonly suppliesService: SuppliesService) {}

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/supplies/suppliers')
  listSuppliers() {
    return this.suppliesService.listSuppliers();
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/supplies/suppliers')
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.suppliesService.createSupplier(dto);
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put('admin/supplies/suppliers/:supplierId')
  updateSupplier(
    @Param('supplierId') supplierId: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliesService.updateSupplier(supplierId, dto);
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/supplies/products')
  listProducts(@Query() query: ListProductsDto) {
    return this.suppliesService.listProducts(query);
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/supplies/products')
  createProduct(@Body() dto: CreateProductDto) {
    return this.suppliesService.createProduct(dto);
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put('admin/supplies/products/:productId')
  updateProduct(
    @Param('productId') productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.suppliesService.updateProduct(productId, dto);
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/supplies/products/:productId/image-upload-url')
  requestProductImageUploadUrl(
    @Param('productId') productId: string,
    @Body() dto: RequestProductImageUploadDto,
  ) {
    return this.suppliesService.requestProductImageUploadUrl(productId, dto);
  }
}

@Controller('vendors/me/supplies')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.VENDOR)
export class VendorSuppliesController {
  constructor(private readonly suppliesService: SuppliesService) {}

  @Get('catalog')
  listCatalog(
    @CurrentUser() user: RequestWithAuth['auth']['user'],
    @Query() query: CatalogQueryDto,
  ) {
    return this.suppliesService.listCatalogForVendor(user.id, query);
  }
}
